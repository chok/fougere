/**
 * Handler signature parser — extracts method signatures from handler source files.
 *
 * The AST says what the author declared; TypeScript's checker says what those types mean.
 * TypeScript is lazy-loaded to avoid bundling the compiler in production builds.
 */
import type ts from '@typescript/typescript6';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, dirname, resolve as resolvePath } from 'node:path';

/** Lazy-loaded TypeScript module — avoids bundling the 9MB compiler. */
let _ts: typeof ts | undefined;
async function loadTS(): Promise<typeof ts> {
  if (!_ts) _ts = (await import('@typescript/typescript6')).default;
  return _ts;
}
function getTS(): typeof ts {
  if (!_ts) throw new Error('TypeScript not loaded — call an async parse function first');
  return _ts;
}

interface TypeProject {
  roots: Set<string>;
  options: ts.CompilerOptions;
  program: ts.Program;
}

/**
 * One checked program per project/configuration during a scan.
 *
 * A checker is a project reader, not a file parser: creating one per handler would reopen
 * the standard library and every imported declaration for each method. `scanProject`
 * resets this map at the start of a run, so an edited source can never meet a program from
 * the previous run.
 */
const typeProjects = new Map<string, TypeProject>();
const compilerProjects = new Map<string, { key: string; roots: string[]; options: ts.CompilerOptions }>();

/**
 * What survives a run: the parsed declarations, and the program built over them.
 *
 * Rebuilding a program re-reads `lib.d.ts` and every imported `.d.ts`, and that is FIXED
 * work — measured, a second scan in one process cost the same at 16 frond files as at 406.
 * The mtime is the guard, so a run still cannot see a stale type: a file that moved is
 * re-read and TypeScript invalidates it and everything depending on it, which is a
 * narrower rule than discarding the program and not a weaker one.
 */
const sourceFiles = new Map<string, { mtime: number; file: ts.SourceFile }>();
const retained = new Map<string, { host: ts.CompilerHost; program: ts.Program }>();

export function resetTypePrograms(): void {
  typeProjects.clear();
  compilerProjects.clear();
}

/** Drop what runs share. For a test that must prove a cold read. */
export function forgetParsedSources(): void {
  sourceFiles.clear();
  retained.clear();
}

function keptHost(key: string, options: ts.CompilerOptions): ts.CompilerHost {
  const held = retained.get(key);
  if (held) return held.host;
  const typescript = getTS();
  const base = typescript.createCompilerHost(options);
  const host: ts.CompilerHost = {
    ...base,
    getSourceFile(fileName, languageVersion, onError, shouldCreate) {
      const path = resolvePath(fileName);
      const mtime = statSync(path, { throwIfNoEntry: false })?.mtimeMs ?? -1;
      const cached = sourceFiles.get(path);
      if (cached && cached.mtime === mtime) return cached.file;
      const file = base.getSourceFile(fileName, languageVersion, onError, shouldCreate);
      if (file && mtime >= 0) sourceFiles.set(path, { mtime, file });
      return file;
    },
  };
  retained.set(key, { host, program: undefined as unknown as ts.Program });
  return host;
}

function builtProgram(key: string, roots: readonly string[], options: ts.CompilerOptions): ts.Program {
  const typescript = getTS();
  const host = keptHost(key, options);
  const program = typescript.createProgram({
    rootNames: [...roots], options, host, oldProgram: retained.get(key)?.program,
  });
  retained.set(key, { host, program });
  return program;
}

function compilerProjectOf(filePath: string, projectRoot?: string): { key: string; roots: string[]; options: ts.CompilerOptions } {
  const typescript = getTS();
  const absolute = resolvePath(filePath);
  const configPath = typescript.findConfigFile(dirname(absolute), typescript.sys.fileExists);

  if (configPath) {
    const key = `${configPath}:${projectRoot ?? ''}`;
    const cached = compilerProjects.get(key);
    if (cached) return cached;

    const read = typescript.readConfigFile(configPath, typescript.sys.readFile);
    if (read.error) throw new Error(typescript.flattenDiagnosticMessageText(read.error.messageText, '\n'));
    const parsed = typescript.parseJsonConfigFileContent(read.config, typescript.sys, dirname(configPath));
    const configured = {
      key,
      // Compiler options belong to the project; its entire include glob does not belong
      // to this scan. Each declaration inspected below becomes a root and TypeScript
      // follows its imports. Seeding the monorepo here made a one-file scan compile it all.
      roots: [],
      // Handlers may be authored or emitted as JavaScript. They still need to belong to
      // the checked program so constructor parsing does not fail on the first cold scan.
      options: { ...parsed.options, allowJs: true, noEmit: true },
    };
    compilerProjects.set(key, configured);
    return configured;
  }

  const key = projectRoot ?? dirname(absolute);
  const cached = compilerProjects.get(key);
  if (cached) return cached;
  const configured = {
    key,
    roots: [],
    options: {
      target: typescript.ScriptTarget.ES2022,
      module: typescript.ModuleKind.Node16,
      moduleResolution: typescript.ModuleResolutionKind.Node16,
      strict: true,
      skipLibCheck: true,
      allowJs: true,
      noEmit: true,
    },
  };
  compilerProjects.set(key, configured);
  return configured;
}

/**
 * Declare every file a run will read, so one program covers it.
 *
 * `checkedSourceOf` rebuilds whenever it meets a root it has not seen, and a frond lives
 * outside its project's tsconfig `include`, so every declaration was a new root: 44 files
 * cost 7.3 s that way against 0.34 s for one program.
 */
export async function seedTypeProgram(filePaths: readonly string[], projectRoot?: string): Promise<void> {
  const typescript = await loadTS();
  const grouped = new Map<string, { options: ts.CompilerOptions; paths: string[] }>();

  for (const filePath of filePaths) {
    const absolute = resolvePath(filePath);
    const configured = compilerProjectOf(absolute, projectRoot);
    const held = grouped.get(configured.key) ?? { options: configured.options, paths: [] };
    held.paths.push(absolute);
    grouped.set(configured.key, held);
  }

  for (const [key, { options, paths }] of grouped) {
    const roots = new Set(typeProjects.get(key)?.roots ?? []);
    for (const path of paths) roots.add(path);
    typeProjects.set(key, { roots, options, program: builtProgram(key, [...roots], options) });
  }
}

function checkedSourceOf(filePath: string, projectRoot?: string): { source: ts.SourceFile; checker: ts.TypeChecker } {
  const typescript = getTS();
  const absolute = resolvePath(filePath);
  const configured = compilerProjectOf(absolute, projectRoot);
  let held = typeProjects.get(configured.key);

  if (!held) {
    // `path.resolve` is variadic, so handing it directly to `map` also passed the
    // index and the whole roots array as path segments. A fixture without a warm scan
    // cache exposed that first-run-only failure.
    const roots = new Set(configured.roots.map((root) => resolvePath(root)));
    roots.add(absolute);
    const program = builtProgram(configured.key, [...roots], configured.options);
    held = { roots, options: configured.options, program };
    typeProjects.set(configured.key, held);
  } else if (!held.roots.has(absolute)) {
    held.roots.add(absolute);
    held.program = builtProgram(configured.key, [...held.roots], held.options);
  }

  const source = held.program.getSourceFile(absolute);
  if (!source) throw new Error(`TypeScript did not include '${absolute}' in its program.`);
  return { source, checker: held.program.getTypeChecker() };
}

/** A file, opened. Five places read and parsed one, each spelling the same two calls. */
function sourceOf(filePath: string): ts.SourceFile {
  const ts = getTS();
  return ts.createSourceFile(filePath, readFileSync(filePath, 'utf-8'), ts.ScriptTarget.Latest, true);
}

/** One declared parameter — a constructor's and a method's are read the same way. */
function parsedParam(param: ts.ParameterDeclaration, source: ts.SourceFile, checker?: ts.TypeChecker): ParsedParam {
  const ts = getTS();
  const type = param.type ? parseTypeNode(param.type, source, checker) : { raw: 'unknown', name: 'unknown' };
  return {
    name: ts.isIdentifier(param.name) ? param.name.text : param.name.getText(source),
    type,
    // `user?: User` and `user: User | undefined` are the same declaration of
    // absence. A type alias may carry the latter, so only the checker can see it.
    optional: param.questionToken !== undefined || param.initializer !== undefined || type.undefined === true,
  };
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
  /** Whether `null` belongs to the type. */
  nullable?: boolean;
  /** Whether absence (`undefined` or `void`) belongs to the type. */
  undefined?: boolean;
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
}

/** Parse a TypeScript type node into a ParsedType. */
function parseTypeNode(node: ts.TypeNode, source: ts.SourceFile, checker?: ts.TypeChecker): ParsedType {
  const ts = getTS();
  const raw = node.getText(source);

  if (checker) {
    // `Fact<T>` is deliberately transparent in TypeScript (`type Fact<T> = T`), because
    // a subscriber receives the payload itself. The checker erases that marker, while
    // the binding plan still needs it to distinguish a fact from an ordinary body.
    if (ts.isTypeReferenceNode(node) && ts.isIdentifier(node.typeName) && node.typeName.text === 'Fact') {
      return {
        raw,
        name: 'Fact',
        generics: node.typeArguments?.map((arg) => parseTypeNode(arg, source, checker)) ?? [],
      };
    }
    return parseCheckedType(checker.getTypeFromTypeNode(node), raw, checker);
  }

  // Union types — extract nullable, strip Promise
  if (ts.isUnionTypeNode(node)) {
    const nonNull = node.types.filter(
      (t) => !(ts.isLiteralTypeNode(t) && t.literal.kind === ts.SyntaxKind.NullKeyword)
        && !(t.kind === ts.SyntaxKind.UndefinedKeyword)
        && !(t.kind === ts.SyntaxKind.VoidKeyword)
        && !(t.kind === ts.SyntaxKind.NullKeyword),
    );
    const nullable = node.types.some((t) =>
      (ts.isLiteralTypeNode(t) && t.literal.kind === ts.SyntaxKind.NullKeyword)
      || t.kind === ts.SyntaxKind.NullKeyword,
    );
    const undefinable = node.types.some((t) =>
      t.kind === ts.SyntaxKind.UndefinedKeyword || t.kind === ts.SyntaxKind.VoidKeyword,
    );
    if (nonNull.length === 1) {
      const inner = parseTypeNode(nonNull[0], source);
      return { ...inner, nullable: nullable || inner.nullable, undefined: undefinable || inner.undefined, raw };
    }
    return { raw, name: raw, nullable, undefined: undefinable };
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
    case ts.SyntaxKind.VoidKeyword: return { raw, name: 'void', undefined: true };
    case ts.SyntaxKind.UndefinedKeyword: return { raw, name: 'undefined', undefined: true };
    case ts.SyntaxKind.NullKeyword: return { raw, name: 'null', nullable: true };
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

function meaningfulSymbolName(type: ts.Type, checker: ts.TypeChecker): string {
  const typescript = getTS();
  const symbol = type.aliasSymbol ?? type.getSymbol();
  if (symbol && symbol.name !== 'default' && !symbol.name.startsWith('__')) return symbol.name;

  for (const declaration of symbol?.declarations ?? []) {
    if (
      (typescript.isClassDeclaration(declaration)
        || typescript.isInterfaceDeclaration(declaration)
        || typescript.isTypeAliasDeclaration(declaration))
      && declaration.name
    ) return declaration.name.text;
  }

  return checker.typeToString(type, undefined, typescript.TypeFormatFlags.NoTruncation);
}

/** Turn a checked TypeScript type into the small, serializable vocabulary the runtime reads. */
function parseCheckedType(type: ts.Type, raw: string, checker: ts.TypeChecker, depth = 0): ParsedType {
  const typescript = getTS();
  if (depth > 12) return { raw, name: checker.typeToString(type) };

  if (type.isUnion()) {
    const nullable = type.types.some((member) => (member.flags & typescript.TypeFlags.Null) !== 0);
    const undefinable = type.types.some((member) =>
      (member.flags & (typescript.TypeFlags.Undefined | typescript.TypeFlags.Void)) !== 0,
    );
    const members = type.types.filter((member) =>
      (member.flags & (typescript.TypeFlags.Null | typescript.TypeFlags.Undefined | typescript.TypeFlags.Void)) === 0,
    );
    // The checker represents the `boolean` keyword itself as `false | true`. Preserve
    // the primitive vocabulary consumed by binding and presenter metadata.
    if (
      members.length > 0
      && members.every((member) => (member.flags & typescript.TypeFlags.BooleanLiteral) !== 0)
    ) {
      return { raw, name: 'boolean', nullable, undefined: undefinable };
    }
    if (members.length === 1) {
      const inner = parseCheckedType(members[0]!, raw, checker, depth + 1);
      return {
        ...inner,
        raw,
        nullable: nullable || inner.nullable,
        undefined: undefinable || inner.undefined,
      };
    }
    return {
      raw,
      name: members.map((member) => meaningfulSymbolName(member, checker)).join(' | ') || raw,
      nullable,
      undefined: undefinable,
    };
  }

  // Present at runtime in the supported compiler versions, but intentionally omitted
  // from TypeScript's public TypeChecker declaration.
  const promised = (checker as ts.TypeChecker & {
    getPromisedTypeOfPromise(candidate: ts.Type): ts.Type | undefined;
  }).getPromisedTypeOfPromise(type);
  if (promised) return { ...parseCheckedType(promised, raw, checker, depth + 1), raw, promise: true };

  if (checker.isArrayType(type)) {
    const [element] = checker.getTypeArguments(type as ts.TypeReference);
    const inner = element ? parseCheckedType(element, raw, checker, depth + 1) : { raw, name: 'unknown' };
    return { ...inner, raw, array: true, arrayDepth: (inner.arrayDepth ?? 0) + 1 };
  }

  if ((type.flags & typescript.TypeFlags.StringLike) !== 0) return { raw, name: 'string' };
  if ((type.flags & typescript.TypeFlags.NumberLike) !== 0) return { raw, name: 'number' };
  if ((type.flags & typescript.TypeFlags.BooleanLike) !== 0) return { raw, name: 'boolean' };
  if ((type.flags & typescript.TypeFlags.Void) !== 0) return { raw, name: 'void', undefined: true };
  if ((type.flags & typescript.TypeFlags.Undefined) !== 0) return { raw, name: 'undefined', undefined: true };
  if ((type.flags & typescript.TypeFlags.Null) !== 0) return { raw, name: 'null', nullable: true };
  if ((type.flags & typescript.TypeFlags.Any) !== 0) return { raw, name: 'any' };
  if ((type.flags & typescript.TypeFlags.Unknown) !== 0) return { raw, name: 'unknown' };

  const reference = type as ts.TypeReference;
  // A declared alias such as `Emit<PostPublished>` may reduce to a function or object
  // type, so it is no longer a TypeReference. The checker keeps its arguments beside
  // `aliasSymbol`; losing them turns DI keys into bare `Emit`/`Facade`.
  const args = (type as ts.Type & { aliasTypeArguments?: readonly ts.Type[] }).aliasTypeArguments
    ?? checker.getTypeArguments(reference);
  return {
    raw,
    name: meaningfulSymbolName(type, checker),
    ...(args.length && { generics: args.map((arg) => parseCheckedType(arg, checker.typeToString(arg), checker, depth + 1)) }),
  };
}

// ── Module resolution ────────────────────────

const TS_KEYWORDS = new Set([
  'string', 'number', 'boolean', 'void', 'undefined', 'null', 'any', 'unknown',
  'never', 'object', 'symbol', 'bigint',
]);


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




/**
 * Extract methods from a class node (no file reading — works on already-parsed AST).
 */
function extractClassMethods(
  cls: ts.ClassDeclaration | ts.ClassExpression,
  source: ts.SourceFile,
  skip: Set<string>,
  checker?: ts.TypeChecker,
): ParsedMethod[] {
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

    const params = member.parameters.map((p) => parsedParam(p, source, checker));
    const returnType = member.type ? parseTypeNode(member.type, source, checker) : undefined;
    results.push({
      name, params, returnType,
      description: docSentenceOf(member, source),
    });
  }

  return results;
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
/**
 * Where a name used here is declared. The checker follows the import, the re-export chain
 * and an installed package's types — the three cases three hand-rolled functions treated
 * separately.
 */
function declarationFileOf(node: ts.Node, checker: ts.TypeChecker): string | undefined {
  const typescript = getTS();
  let symbol = checker.getSymbolAtLocation(node);
  if (!symbol) return undefined;
  if (symbol.flags & typescript.SymbolFlags.Alias) symbol = checker.getAliasedSymbol(symbol);
  return symbol.declarations?.[0]?.getSourceFile().fileName;
}

/**
 * The methods a base class contributes, read from the INSTANTIATED type.
 *
 * `extends Crud(Post)` gives `create(input: Partial<Post>)` directly: the checker has
 * already substituted the mixin's type parameter. The three functions this replaces
 * detected the generic names and mapped them to the mixin's arguments by position.
 */
function inheritedFromBase(
  base: ts.ExpressionWithTypeArguments,
  checker: ts.TypeChecker,
  skip: Set<string>,
): ParsedMethod[] {
  const typescript = getTS();
  const results: ParsedMethod[] = [];

  for (const property of checker.getPropertiesOfType(checker.getTypeAtLocation(base))) {
    if (skip.has(property.name)) continue;

    // `private`/`protected` is a statement about the surface, and the declaration carries
    // it. A door is what the author declares public.
    const declaration = property.declarations?.[0];
    if (declaration && typescript.canHaveModifiers(declaration)
      && typescript.getModifiers(declaration)?.some((m) => m.kind === typescript.SyntaxKind.PrivateKeyword
        || m.kind === typescript.SyntaxKind.ProtectedKeyword)) continue;

    const signature = checker.getTypeOfSymbolAtLocation(property, base).getCallSignatures()[0];
    if (!signature) continue;

    const returned = signature.getReturnType();
    const sentence = typescript.displayPartsToString(property.getDocumentationComment(checker)).trim();
    results.push({
      name: property.name,
      params: signature.getParameters().map((parameter) => {
        const type = checker.getTypeOfSymbolAtLocation(parameter, base);
        return {
          name: parameter.name,
          type: parseCheckedType(type, checker.typeToString(type), checker),
          optional: (parameter.flags & typescript.SymbolFlags.Optional) !== 0,
        };
      }),
      returnType: parseCheckedType(returned, checker.typeToString(returned), checker),
      ...(sentence ? { description: sentence.split(/(?<=\.)\s/)[0] } : {}),
    });
  }
  return results;
}

function parseInheritedMethods(
  cls: ts.ClassDeclaration,
  source: ts.SourceFile,
  checker: ts.TypeChecker,
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

    for (const base of clause.types) {
      const fromType = inheritedFromBase(base, checker, skip);
      if (fromType.length > 0) return fromType;

      // A factory that ERASES its own type — `assertShape<unknown>(class …)`, `as unknown`
      // — leaves the checker with nothing to enumerate. The written class is still there,
      // so read it. This is the one case where what the author wrote beats what it means.
      const expression = base.expression;
      const declared = ts.isCallExpression(expression) && ts.isIdentifier(expression.expression)
        ? declarationFileOf(expression.expression, checker)
        : ts.isIdentifier(expression) ? declarationFileOf(expression, checker) : undefined;
      if (!declared) { unresolved.push(expression.getText(source)); continue; }

      const declaredSource = sourceOf(declared);
      const written = ts.isCallExpression(expression) && ts.isIdentifier(expression.expression)
        ? findClassInFunction(declaredSource, expression.expression.text)
        : findDefaultClass(declaredSource);
      if (!written) { unresolved.push(expression.getText(source)); continue; }

      return extractClassMethods(written, declaredSource, skip);
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

/**
 * Every method a handler declares, its inherited ones included — the raw material of a
 * binding plan. With a `projectRoot`, the heritage clause is followed too.
 */
export async function parseAllHandlerMethods(filePath: string, projectRoot?: string): Promise<HandlerParse> {
  await loadTS();
  return parseClassMethods(filePath, CONSTRUCTOR_ONLY, projectRoot);
}

/**
 * Parse a presenter source file and extract all method signatures.
 *
 * Returns all methods (no CRUD filtering) — each method is a computed field.
 */
export async function parsePresenterMethods(filePath: string, projectRoot?: string): Promise<ParsedMethod[]> {
  await loadTS();
  // No `projectRoot`, so no heritage pass and nothing to report: a presenter's
  // computed fields are its own methods.
  return parseClassMethods(filePath, CONSTRUCTOR_ONLY, undefined, projectRoot).methods;
}

/**
 * Parse constructor parameter types from a source file's default class.
 * Returns type names (e.g. ['PostOrm', 'Logger']) for DI resolution.
 */
export async function parseConstructorParams(filePath: string, projectRoot?: string): Promise<ParsedParam[]> {
  const ts = await loadTS();
  const { source, checker } = checkedSourceOf(filePath, projectRoot);
  const cls = findDefaultClass(source);
  if (!cls) return [];

  const ctor = cls.members.find(ts.isConstructorDeclaration);
  return ctor ? ctor.parameters.map((p) => parsedParam(p, source, checker)) : [];
}

const CONSTRUCTOR_ONLY = new Set(['constructor']);

function parseClassMethods(
  filePath: string,
  skip: Set<string>,
  heritageRoot?: string,
  typeRoot: string | undefined = heritageRoot,
): HandlerParse {
  const unresolved: string[] = [];
  const { source, checker } = checkedSourceOf(filePath, typeRoot);
  const cls = findDefaultClass(source);
  if (!cls) return { methods: [], unresolvedHeritage: unresolved };

  const childMethods = extractClassMethods(cls, source, skip, checker);
  const childNames = new Set(childMethods.map((m) => m.name));

  // Parse inherited methods (if projectRoot is provided for resolution)
  if (heritageRoot) {
    const inherited = parseInheritedMethods(cls, source, checker, skip, unresolved);
    // Merge: child methods win over inherited
    const parentOnly = inherited
      .filter((m) => !childNames.has(m.name))
      .map((m) => ({ ...m, inherited: true }));
    return { methods: [...childMethods, ...parentOnly], unresolvedHeritage: unresolved };
  }

  return { methods: childMethods, unresolvedHeritage: unresolved };
}
