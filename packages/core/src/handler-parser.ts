/**
 * Handler signature parser — extracts method signatures from handler source files.
 *
 * Uses TypeScript's createSourceFile() for lightweight AST parsing (no type checker).
 * TypeScript is lazy-loaded to avoid bundling the 9MB compiler in production builds.
 */
import type ts from 'typescript';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname, resolve as resolvePath } from 'node:path';

/** Lazy-loaded TypeScript module — avoids bundling the 9MB compiler. */
let _ts: typeof ts | undefined;
async function loadTS(): Promise<typeof ts> {
  if (!_ts) _ts = (await import('typescript')).default;
  return _ts;
}
function getTS(): typeof ts {
  if (!_ts) throw new Error('TypeScript not loaded — call an async parse function first');
  return _ts;
}

/** A parsed type reference — supports primitives, entities, arrays, generics. */
export interface ParsedType {
  /** Raw type text as written in source (e.g. 'Pagination<Post>'). */
  raw: string;
  /** Base type name (e.g. 'Pagination', 'string', 'Post'). */
  name: string;
  /** Whether this is an array (T[] or Array<T>) — true at any depth. */
  array?: boolean;
  /**
   * How MANY array levels: `string[]` is 1, `string[][]` is 2. `array` only ever said
   * "at least one", which sufficed while one level meant one thing. It stopped sufficing
   * when a presenter method started taking the page — there the outer level IS the page
   * and what remains is the field, so telling `string[]` from `string[][]` is telling a
   * computed string from a computed list.
   */
  arrayDepth?: number;
  /** Generic type arguments (e.g. for Pagination<Post> → [{ name: 'Post' }]). */
  generics?: ParsedType[];
  /** Whether the type is nullable (T | null | undefined). */
  nullable?: boolean;
  /** Whether this is a Promise wrapper (unwrapped in output). */
  promise?: boolean;
}

/** A parsed method parameter. */
export interface ParsedParam {
  name: string;
  type: ParsedType;
  optional?: boolean;
}

/** A parsed method signature from a handler source file. */
export interface ParsedMethod {
  name: string;
  params: ParsedParam[];
  returnType?: ParsedType;
  /**
   * Came from a base class, not from the file being scanned. What a prefab
   * handler declares about its own ops beats this — the scan reads a signature
   * and guesses, the builder knows.
   */
  inherited?: boolean;
  /**
   * The operation in words — the first sentence of the method's doc comment.
   *
   * Not a new thing to write: handlers already carry it (`/** Judge: the author,
   * a draft… *&#47;`), the AST already holds it, and nothing read it. A caller that
   * discovers an operation over the wire has its name and its schema; what the
   * operation is FOR lived only in the source.
   */
  description?: string;
  /**
   * The body was read and makes no write — the op is a query.
   *
   * `true` is PROOF, not a guess: every call the method makes on `this` names a read
   * gesture. `false` means a write was seen, or a call this cannot classify — a façade,
   * an emission, an injected function. `undefined` means there was no body to read.
   *
   * It exists because the name never said this. `isReadOp` matches seven prefixes, and
   * an app that names its reads in domain terms — `ofBook`, `roots`, `bySlug` — had all
   * of them announced as mutations. Naming is the author's; writing is a fact.
   */
  readOnly?: boolean;
}

/** Seeing one of these is proof the op writes, whatever it is called. */
const WRITE_GESTURES = new Set([
  'create', 'createAll', 'update', 'updateAll', 'upsert', 'upsertAll', 'delete', 'deleteAll', 'refresh',
]);

/**
 * The only calls on `this` a query may make.
 *
 * Not a list of what reads — a list of what this can RECOGNIZE as reading. Anything
 * else rooted at `this` (a façade, an emission, a service) leaves the question open,
 * and an open question answers `mutation`: announcing a write as a query would let it
 * be cached and sent over GET.
 */
const READ_GESTURES = new Set([
  'list', 'findById', 'findBy', 'findAllBy', 'findByKeys', 'findAllByKeys', 'count', 'exists', 'read',
]);

/** Parse a TypeScript type node into a ParsedType. */
function parseTypeNode(node: ts.TypeNode, source: ts.SourceFile): ParsedType {
  const ts = getTS();
  const raw = node.getText(source);

  // Union types — extract nullable, strip Promise
  if (ts.isUnionTypeNode(node)) {
    const nonNull = node.types.filter(
      (t) => !(ts.isLiteralTypeNode(t) && t.literal.kind === ts.SyntaxKind.NullKeyword)
        && !(t.kind === ts.SyntaxKind.UndefinedKeyword)
        && !(t.kind === ts.SyntaxKind.VoidKeyword)
        && !(t.kind === ts.SyntaxKind.NullKeyword),
    );
    const nullable = nonNull.length < node.types.length;
    if (nonNull.length === 1) {
      const inner = parseTypeNode(nonNull[0], source);
      return { ...inner, nullable: nullable || inner.nullable, raw };
    }
    return { raw, name: raw, nullable };
  }

  // Promise<T> — unwrap
  if (ts.isTypeReferenceNode(node)) {
    const typeName = node.typeName.getText(source);

    if (typeName === 'Promise' && node.typeArguments?.length === 1) {
      const inner = parseTypeNode(node.typeArguments[0], source);
      return { ...inner, promise: true, raw };
    }

    // Array<T>
    if (typeName === 'Array' && node.typeArguments?.length === 1) {
      const inner = parseTypeNode(node.typeArguments[0], source);
      return { ...inner, array: true, arrayDepth: (inner.arrayDepth ?? 0) + 1, raw };
    }

    // Generic type: Foo<Bar, Baz>
    if (node.typeArguments && node.typeArguments.length > 0) {
      const generics = node.typeArguments.map((arg) => parseTypeNode(arg, source));
      return { raw, name: typeName, generics };
    }

    // Simple type reference: Post, string, etc.
    return { raw, name: typeName };
  }

  // T[]
  if (ts.isArrayTypeNode(node)) {
    const inner = parseTypeNode(node.elementType, source);
    return { ...inner, array: true, arrayDepth: (inner.arrayDepth ?? 0) + 1, raw };
  }

  // Keyword types: string, number, boolean, void
  switch (node.kind) {
    case ts.SyntaxKind.StringKeyword: return { raw, name: 'string' };
    case ts.SyntaxKind.NumberKeyword: return { raw, name: 'number' };
    case ts.SyntaxKind.BooleanKeyword: return { raw, name: 'boolean' };
    case ts.SyntaxKind.VoidKeyword: return { raw, name: 'void' };
    case ts.SyntaxKind.UndefinedKeyword: return { raw, name: 'undefined' };
    case ts.SyntaxKind.NullKeyword: return { raw, name: 'null' };
    case ts.SyntaxKind.AnyKeyword: return { raw, name: 'any' };
    case ts.SyntaxKind.UnknownKeyword: return { raw, name: 'unknown' };
  }

  // Object literal type: { title: string; limit: number }
  if (ts.isTypeLiteralNode(node)) {
    return { raw, name: raw };
  }

  // Fallback
  return { raw, name: raw };
}

// ── Module resolution ────────────────────────

const TS_KEYWORDS = new Set([
  'string', 'number', 'boolean', 'void', 'undefined', 'null', 'any', 'unknown',
  'never', 'object', 'symbol', 'bigint',
]);

/**
 * Resolve an imported identifier to its source file path.
 * Handles relative imports (./) and workspace packages (@fougere/*).
 */
function resolveImportPath(
  source: ts.SourceFile,
  identifierName: string,
  filePath: string,
  projectRoot: string,
): string | undefined {
  const ts = getTS();
  for (const stmt of source.statements) {
    if (!ts.isImportDeclaration(stmt)) continue;
    if (!ts.isStringLiteral(stmt.moduleSpecifier)) continue;

    const bindings = stmt.importClause;
    if (!bindings) continue;

    // Named imports: import { Crud } from '...'
    if (bindings.namedBindings && ts.isNamedImports(bindings.namedBindings)) {
      const found = bindings.namedBindings.elements.some((e) => e.name.text === identifierName);
      if (!found) continue;
    }
    // Default import: import X from '...'
    else if (bindings.name?.text !== identifierName) {
      continue;
    }

    const specifier = stmt.moduleSpecifier.text;
    return resolveSpecifier(specifier, filePath, projectRoot);
  }
  return undefined;
}

/** Resolve an import specifier to an absolute file path. */
function resolveSpecifier(specifier: string, fromFile: string, projectRoot: string): string | undefined {
  // Relative import
  if (specifier.startsWith('.')) {
    const dir = dirname(fromFile);
    let resolved = resolvePath(dir, specifier);
    // .js → .ts
    if (resolved.endsWith('.js')) resolved = resolved.slice(0, -3) + '.ts';
    if (!resolved.endsWith('.ts')) resolved += '.ts';
    if (existsSync(resolved)) return resolved;
    return undefined;
  }

  // Workspace package: @fougere/core → packages/core/src/index.ts
  const match = specifier.match(/^@fougere\/([^/]+)$/);
  if (match) {
    const pkgDir = join(projectRoot, 'packages', match[1], 'src');
    const indexPath = join(pkgDir, 'index.ts');
    if (existsSync(indexPath)) return indexPath;
  }

  return undefined;
}

/**
 * Follow re-exports in an index file to find the source of a named export.
 * e.g. `export { Crud } from './crud.js'` → resolves to crud.ts
 */
function followReExport(
  indexPath: string,
  identifierName: string,
  projectRoot: string,
): string | undefined {
  const ts = getTS();
  const content = readFileSync(indexPath, 'utf-8');
  const source = ts.createSourceFile(indexPath, content, ts.ScriptTarget.Latest, true);

  for (const stmt of source.statements) {
    if (!ts.isExportDeclaration(stmt)) continue;
    if (!stmt.moduleSpecifier || !ts.isStringLiteral(stmt.moduleSpecifier)) continue;

    // export { Crud } from './crud.js'
    if (stmt.exportClause && ts.isNamedExports(stmt.exportClause)) {
      const found = stmt.exportClause.elements.some((e) => {
        const exportedName = e.name.text;
        const localName = e.propertyName?.text ?? e.name.text;
        return exportedName === identifierName || localName === identifierName;
      });
      if (!found) continue;
    }

    // export * from './crud.js' — also follow (could contain the identifier)
    const resolved = resolveSpecifier(stmt.moduleSpecifier.text, indexPath, projectRoot);
    if (resolved) return resolved;
  }

  return undefined;
}

/**
 * Find the full source file for an identifier, following re-exports if needed.
 */
function resolveIdentifierSource(
  source: ts.SourceFile,
  identifierName: string,
  filePath: string,
  projectRoot: string,
): string | undefined {
  const importPath = resolveImportPath(source, identifierName, filePath, projectRoot);
  if (!importPath) return undefined;

  // If it's an index file, follow re-exports
  if (importPath.endsWith('index.ts')) {
    return followReExport(importPath, identifierName, projectRoot) ?? importPath;
  }

  return importPath;
}

// ── Mixin / heritage parsing ─────────────────

/**
 * The class a returned expression carries, however it is wrapped.
 *
 * A mixin does not always hand its class back bare. `Crud` returns
 * `asCrudConstructor(class CrudHandler { … })` — one assertion helper standing between
 * `return` and the class — and a parser accepting only a bare `return class` found
 * nothing there, silently: the five inherited CRUD ops stopped being derived, and a warm
 * scan cache kept answering the old parse for weeks (`scan-cache.ts` keys on source, not
 * on parser version).
 *
 * So unwrap rather than match one shape: descend through call arguments, `as` and
 * `satisfies` assertions, and parentheses. What is looked for is a class; where the
 * author put it is their business.
 */
function classInExpression(expr: ts.Node, depth = 0): ts.ClassExpression | undefined {
  const ts = getTS();
  if (depth > 8) return undefined;
  if (ts.isClassExpression(expr)) return expr;
  if (ts.isCallExpression(expr)) {
    for (const arg of expr.arguments) {
      const found = classInExpression(arg, depth + 1);
      if (found) return found;
    }
    return undefined;
  }
  if (ts.isAsExpression(expr) || ts.isSatisfiesExpression(expr) || ts.isParenthesizedExpression(expr)) {
    return classInExpression(expr.expression, depth + 1);
  }
  return undefined;
}

/** Find a class declaration inside a function (mixin pattern). */
function findClassInFunction(source: ts.SourceFile, functionName: string): ts.ClassDeclaration | ts.ClassExpression | undefined {
  const ts = getTS();
  for (const stmt of source.statements) {
    if (!ts.isFunctionDeclaration(stmt)) continue;
    if (stmt.name?.text !== functionName) continue;
    if (!stmt.body) continue;

    // Walk statements inside the function
    for (const inner of stmt.body.statements) {
      // return class CrudHandler { … }, or the same class behind a wrapper
      if (ts.isReturnStatement(inner) && inner.expression) {
        const found = classInExpression(inner.expression);
        if (found) return found;
      }
      // class CrudHandler { ... } (followed by return)
      if (ts.isClassDeclaration(inner)) return inner;
    }
  }
  return undefined;
}

/** Recursively substitute type names in a ParsedType. */
function substituteType(type: ParsedType, sub: Map<string, string>): ParsedType {
  const newName = sub.get(type.name) ?? type.name;
  const newGenerics = type.generics?.map((g) => substituteType(g, sub));
  if (newName === type.name && !newGenerics) return type;
  return {
    ...type,
    name: newName,
    raw: type.raw, // keep original raw for debugging
    generics: newGenerics ?? type.generics,
  };
}

/** Substitute all type references in parsed methods. */
function substituteMethods(methods: ParsedMethod[], sub: Map<string, string>): ParsedMethod[] {
  return methods.map((m) => ({
    ...m,
    params: m.params.map((p) => ({
      ...p,
      type: substituteType(p.type, sub),
    })),
    returnType: m.returnType ? substituteType(m.returnType, sub) : undefined,
  }));
}

/**
 * Detect generic type references in methods — names that are not keywords
 * and not imported in the given source file.
 */
function detectGenericNames(methods: ParsedMethod[], source: ts.SourceFile): Set<string> {
  const ts = getTS();
  const imported = new Set<string>();
  for (const stmt of source.statements) {
    if (!ts.isImportDeclaration(stmt)) continue;
    const bindings = stmt.importClause;
    if (!bindings) continue;
    if (bindings.name) imported.add(bindings.name.text);
    if (bindings.namedBindings && ts.isNamedImports(bindings.namedBindings)) {
      for (const el of bindings.namedBindings.elements) imported.add(el.name.text);
    }
  }

  const generics = new Set<string>();
  const collectFromType = (t: ParsedType) => {
    if (t.name.length <= 2 && /^[A-Z]/.test(t.name) && !TS_KEYWORDS.has(t.name) && !imported.has(t.name)) {
      generics.add(t.name);
    }
    t.generics?.forEach(collectFromType);
  };

  for (const m of methods) {
    m.params.forEach((p) => collectFromType(p.type));
    if (m.returnType) collectFromType(m.returnType);
  }

  return generics;
}

/**
 * Extract methods from a class node (no file reading — works on already-parsed AST).
 */
function extractClassMethods(cls: ts.ClassDeclaration | ts.ClassExpression, source: ts.SourceFile, skip: Set<string>): ParsedMethod[] {
  const ts = getTS();
  const results: ParsedMethod[] = [];

  for (const member of cls.members) {
    if (!ts.isMethodDeclaration(member)) continue;
    if (!member.name || !ts.isIdentifier(member.name)) continue;
    // `private`/`protected` is a statement about the surface, and the AST carries it —
    // it was read past. Every helper a handler names by intent (`mustOwn`, `readMany`,
    // `refuse`) became a callable op: measured on the bench, `list.readMany` executed
    // and `list.mayPublish` judged its argument. A door is what the author declares
    // public, and TypeScript already has the word for it. `#name` is private too, but
    // it is not an identifier, so it never reached here in the first place.
    if (member.modifiers?.some((m) => m.kind === ts.SyntaxKind.PrivateKeyword || m.kind === ts.SyntaxKind.ProtectedKeyword)) continue;

    const name = member.name.text;
    if (skip.has(name)) continue;

    const params: ParsedParam[] = member.parameters.map((p) => ({
      name: ts.isIdentifier(p.name) ? p.name.text : p.name.getText(source),
      type: p.type ? parseTypeNode(p.type, source) : { raw: 'unknown', name: 'unknown' },
      optional: p.questionToken !== undefined || p.initializer !== undefined,
    }));

    const returnType = member.type ? parseTypeNode(member.type, source) : undefined;
    results.push({
      name, params, returnType,
      description: docSentenceOf(member, source),
      readOnly: readOnlyBody(member),
    });
  }

  return results;
}

/**
 * Whether the body proves the op writes nothing.
 *
 * One pass over the calls. A write gesture anywhere settles it; otherwise every call
 * whose receiver bottoms out at `this` must name a read gesture. Calls on anything
 * else — an array, a promise, a local — are not the port and are left alone.
 */
function readOnlyBody(member: ts.MethodDeclaration): boolean | undefined {
  const ts = getTS();
  if (!member.body) return undefined;

  const rootsAtThis = (node: ts.Expression): boolean => {
    let cur: ts.Node = node;
    while (ts.isPropertyAccessExpression(cur) || ts.isElementAccessExpression(cur)) cur = cur.expression;
    return cur.kind === ts.SyntaxKind.ThisKeyword;
  };

  let proven = true;
  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node)) {
      const callee = node.expression;
      if (ts.isPropertyAccessExpression(callee)) {
        const gesture = callee.name.text;
        // `this.published({…})` lands here too — an injected `Emit<T>` is a property of
        // `this` called as a function, and an emission is a write on someone else's
        // storage. It is not in READ_GESTURES, which is the whole answer.
        if (WRITE_GESTURES.has(gesture)) proven = false;
        else if (rootsAtThis(callee.expression) && !READ_GESTURES.has(gesture)) proven = false;
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(member.body);
  return proven;
}

/**
 * The first sentence of a member's doc comment, or nothing.
 *
 * One sentence on purpose: what a caller needs to choose an operation is a claim,
 * not an essay, and the rest of the comment addresses whoever edits the method.
 * Reads the leading trivia rather than `ts.getJSDocTags` — the comment is what the
 * author wrote, tags are a schema they never agreed to.
 */
function docSentenceOf(member: ts.Node, source: ts.SourceFile): string | undefined {
  const ts = getTS();
  const ranges = ts.getLeadingCommentRanges(source.text, member.pos) ?? [];
  const block = ranges.filter((r) => source.text.slice(r.pos, r.pos + 3) === '/**').pop();
  if (!block) return undefined;

  const body = source.text
    .slice(block.pos + 3, block.end - 2)
    .split('\n')
    .map((line) => line.replace(/^\s*\*/, '').trim())
    .join(' ')
    .trim();

  const [sentence] = body.split(/(?<=\.)\s/);

  return sentence?.trim() || undefined;
}

/**
 * Parse inherited methods from a class's heritage clause.
 * Handles both `extends Crud(Entity)` (mixin) and `extends BaseClass` patterns.
 */
function parseInheritedMethods(
  cls: ts.ClassDeclaration,
  source: ts.SourceFile,
  filePath: string,
  projectRoot: string,
  skip: Set<string>,
  /**
   * Base classes this pass could not open — an INSTALLED one, typically, whose
   * source is not in the workspace. Reported rather than treated as "no inherited
   * method": the two used to be the same answer, so an op inherited from a
   * published base class was absent from the façade without a word.
   */
  unresolved: string[],
): ParsedMethod[] {
  const ts = getTS();
  if (!cls.heritageClauses) return [];

  for (const clause of cls.heritageClauses) {
    if (clause.token !== ts.SyntaxKind.ExtendsKeyword) continue;

    for (const baseType of clause.types) {
      const expr = baseType.expression;

      // extends Crud(Entity) — mixin pattern (CallExpression)
      if (ts.isCallExpression(expr) && ts.isIdentifier(expr.expression)) {
        const mixinName = expr.expression.text;
        // Extract mixin argument name (the entity identifier)
        const mixinArgs = expr.arguments
          .filter(ts.isIdentifier)
          .map((a) => a.text);

        const mixinFile = resolveIdentifierSource(source, mixinName, filePath, projectRoot);
        if (!mixinFile) { unresolved.push(`${mixinName}(…)`); continue; }

        const mixinContent = readFileSync(mixinFile, 'utf-8');
        const mixinSource = ts.createSourceFile(mixinFile, mixinContent, ts.ScriptTarget.Latest, true);

        const innerClass = findClassInFunction(mixinSource, mixinName);
        if (!innerClass) { unresolved.push(`${mixinName}(…)`); continue; }

        const parentMethods = extractClassMethods(innerClass, mixinSource, skip);

        // Build substitution map: detect generics in parent methods, map to mixin args
        const genericNames = detectGenericNames(parentMethods, mixinSource);
        if (genericNames.size > 0 && mixinArgs.length > 0) {
          const sub = new Map<string, string>();
          const genericArr = [...genericNames];
          // Map generics to mixin arguments by position (usually just T → Entity)
          for (let i = 0; i < Math.min(genericArr.length, mixinArgs.length); i++) {
            sub.set(genericArr[i], mixinArgs[i]);
          }
          return substituteMethods(parentMethods, sub);
        }

        return parentMethods;
      }

      // extends BaseClass — simple inheritance (Identifier)
      if (ts.isIdentifier(expr)) {
        const parentName = expr.text;
        const parentFile = resolveIdentifierSource(source, parentName, filePath, projectRoot);
        if (!parentFile) { unresolved.push(parentName); continue; }

        const parentContent = readFileSync(parentFile, 'utf-8');
        const parentSource = ts.createSourceFile(parentFile, parentContent, ts.ScriptTarget.Latest, true);
        const parentClass = findDefaultClass(parentSource);
        if (!parentClass) { unresolved.push(parentName); continue; }

        return extractClassMethods(parentClass, parentSource, skip);
      }
    }
  }

  return [];
}

// ── Class finding ────────────────────────────

/** Find the default exported class in a source file. */
function findDefaultClass(source: ts.SourceFile): ts.ClassDeclaration | undefined {
  const ts = getTS();
  for (const stmt of source.statements) {
    // export default class Foo { ... }
    if (ts.isClassDeclaration(stmt) && stmt.modifiers?.some(
      (m) => m.kind === ts.SyntaxKind.ExportKeyword,
    ) && stmt.modifiers?.some(
      (m) => m.kind === ts.SyntaxKind.DefaultKeyword,
    )) {
      return stmt;
    }
  }

  // export default Foo (separate statement) — find the class it points to
  for (const stmt of source.statements) {
    if (ts.isExportAssignment(stmt) && !stmt.isExportEquals && ts.isIdentifier(stmt.expression)) {
      const name = stmt.expression.text;
      for (const s of source.statements) {
        if (ts.isClassDeclaration(s) && s.name?.text === name) return s;
      }
    }
  }

  return undefined;
}

/**
 * Parse ALL method signatures from a handler source file (CRUD included).
 *
 * Used by the binding algorithm — every operation gets a BindingPlan.
 * When projectRoot is provided, follows heritage clauses to parse parent methods.
 */
/**
 * What a handler file yielded — its methods, AND what the pass could not open.
 *
 * The second half is why this is a pair rather than an array: an unresolvable base
 * class used to give the same answer as a base class with no method, so an op
 * inherited from an installed package was missing from the façade in silence. The
 * pair travels through the scan cache, which is why {@link PARSER_VERSION} moved.
 */
export interface HandlerParse {
  methods: ParsedMethod[];
  /** Base classes whose source this pass could not open. Empty is a claim. */
  unresolvedHeritage: string[];
}

export async function parseAllHandlerMethods(filePath: string, projectRoot?: string): Promise<HandlerParse> {
  await loadTS();
  return parseClassMethods(filePath, CONSTRUCTOR_ONLY, projectRoot);
}

/**
 * Parse a presenter source file and extract all method signatures.
 *
 * Returns all methods (no CRUD filtering) — each method is a computed field.
 */
export async function parsePresenterMethods(filePath: string): Promise<ParsedMethod[]> {
  await loadTS();
  // No `projectRoot`, so no heritage pass and nothing to report: a presenter's
  // computed fields are its own methods.
  return parseClassMethods(filePath, CONSTRUCTOR_ONLY).methods;
}

/**
 * Parse constructor parameter types from a source file's default class.
 * Returns type names (e.g. ['PostOrm', 'Logger']) for DI resolution.
 */
export async function parseConstructorParams(filePath: string): Promise<ParsedParam[]> {
  const ts = await loadTS();
  const content = readFileSync(filePath, 'utf-8');
  const source = ts.createSourceFile(filePath, content, ts.ScriptTarget.Latest, true);
  const cls = findDefaultClass(source);
  if (!cls) return [];

  for (const member of cls.members) {
    if (ts.isConstructorDeclaration(member)) {
      return member.parameters.map((p) => ({
        name: ts.isIdentifier(p.name) ? p.name.text : p.name.getText(source),
        type: p.type ? parseTypeNode(p.type, source) : { raw: 'unknown', name: 'unknown' },
        optional: p.questionToken !== undefined || p.initializer !== undefined,
      }));
    }
  }
  return [];
}

const CONSTRUCTOR_ONLY = new Set(['constructor']);

function parseClassMethods(filePath: string, skip: Set<string>, projectRoot?: string): HandlerParse {
  const ts = getTS();
  const unresolved: string[] = [];
  const content = readFileSync(filePath, 'utf-8');
  const source = ts.createSourceFile(filePath, content, ts.ScriptTarget.Latest, true);
  const cls = findDefaultClass(source);
  if (!cls) return { methods: [], unresolvedHeritage: unresolved };

  // Parse child class methods
  const childMethods = extractClassMethods(cls, source, skip);
  const childNames = new Set(childMethods.map((m) => m.name));

  // Parse inherited methods (if projectRoot is provided for resolution)
  if (projectRoot) {
    const inherited = parseInheritedMethods(cls, source, filePath, projectRoot, skip, unresolved);
    // Merge: child methods win over inherited
    const parentOnly = inherited
      .filter((m) => !childNames.has(m.name))
      .map((m) => ({ ...m, inherited: true }));
    return { methods: [...childMethods, ...parentOnly], unresolvedHeritage: unresolved };
  }

  return { methods: childMethods, unresolvedHeritage: unresolved };
}
