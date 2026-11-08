import { type Signature } from '@fougere/core/descriptor';
import type ts from '@typescript/typescript6';
import { getTS, checkedSourceOf, sourceOf, findDefaultClass } from './TypeProgram.js';
import { answeredBy, notData, parseCheckedType, parsedParam, parseTypeNode } from './typeRef.js';

/** The class a returned expression carries, however it is wrapped. */
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
): Signature[] {
  const ts = getTS();
  const results: Signature[] = [];

  for (const member of cls.members) {
    if (!ts.isMethodDeclaration(member)) continue;
    if (!member.name || !ts.isIdentifier(member.name)) continue;
    // `private`/`protected` is a statement about the surface, and the AST carries it —
    // it was read past. Every helper a handler names by intent (`mustOwn`, `readMany`,
    // `refuse`) became a callable op: measured on the bench, `list.readMany` executed
    // and `list.mayPublish` validated its argument. A facade is what the author declares
    // public, and TypeScript already has the word for it. `#name` is private too, but
    // it is not an identifier, so it never reached here in the first place.
    if (member.modifiers?.some((m) => m.kind === ts.SyntaxKind.PrivateKeyword || m.kind === ts.SyntaxKind.ProtectedKeyword)) continue;

    const name = member.name.text;
    if (skip.has(name)) continue;

    const params = member.parameters.map((p) => parsedParam(p, source, checker));
    // An op that annotates nothing still HAS a return type, and the checker holds it — so it
    // carries an output on the card, a cardinality, and the codecs a caller reads it back
    // through. Measured 2026-09-18: 18 of the 42 unannotated ops here answer a declared entity,
    // and every one of them handed a caller the encoded row its type called a `Date`.
    const answered = checker ? answeredBy(checker.getSignatureFromDeclaration(member), checker) : undefined;
    const returnType = member.type ? parseTypeNode(member.type, source, checker)
      : answered && checker ? parseCheckedType(answered, checker.typeToString(answered), checker)
      : undefined;
    const refused = answered && checker ? notData(answered, name, checker) : undefined;
    results.push({
      name, params, returnType,
      ...(refused ? { notData: refused } : {}),
      description: docSentenceOf(member, source),
    });
  }

  return results;
}

/** The first sentence of a member's doc comment, or nothing. */
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
 * Handles both `extends Repository<Entity>` (mixin) and `extends BaseClass` patterns.
 */
/** Where a name used here is declared. */
function declarationFileOf(node: ts.Node, checker: ts.TypeChecker): string | undefined {
  const typescript = getTS();
  let symbol = checker.getSymbolAtLocation(node);
  if (!symbol) return undefined;
  if (symbol.flags & typescript.SymbolFlags.Alias) symbol = checker.getAliasedSymbol(symbol);

  return symbol.declarations?.[0]?.getSourceFile().fileName;
}

/** The methods a base class contributes, read from the INSTANTIATED type. */
/** Whether a base written in an `extends` clause is core's `Repository`. */
function isCoreRepository(base: ts.ExpressionWithTypeArguments, checker: ts.TypeChecker): boolean {
  const symbol = checker.getTypeAtLocation(base).getSymbol();

  return symbol?.name === 'Repository'
    && (symbol.declarations ?? []).some((one) => /[\\/](core[\\/](src|dist)|@fougere[\\/]core)[\\/]/.test(one.getSourceFile().fileName));
}

/** A member core's `Repository` declares — not one a project's base class wrote over it. */
function isCoreRepositoryMember(declaration: ts.Declaration): boolean {
  const owner = declaration.parent as { name?: { text?: string } } | undefined;

  return owner?.name?.text === 'Repository' && /[\\/](core[\\/](src|dist)|@fougere[\\/]core)[\\/]/.test(declaration.getSourceFile().fileName);
}

function inheritedFromBase(
  base: ts.ExpressionWithTypeArguments,
  checker: ts.TypeChecker,
  skip: Set<string>,
): Signature[] {
  const typescript = getTS();
  const results: Signature[] = [];

  for (const property of checker.getPropertiesOfType(checker.getTypeAtLocation(base))) {
    if (skip.has(property.name)) continue;

    // `private`/`protected` is a statement about the surface, and the declaration carries
    // it. A facade is what the author declares public.
    const declaration = property.declarations?.[0];
    // What `Repository<…>` serves is the five it declares itself (`__ops`), never every gesture of
    // the rows it forwards: those stay the class's own, callable and not served.
    if (declaration && isCoreRepositoryMember(declaration)) continue;
    if (declaration && typescript.canHaveModifiers(declaration)
      && typescript.getModifiers(declaration)?.some((m) => m.kind === typescript.SyntaxKind.PrivateKeyword
        || m.kind === typescript.SyntaxKind.ProtectedKeyword)) continue;

    const signature = checker.getTypeOfSymbolAtLocation(property, base).getCallSignatures()[0];
    if (!signature) continue;

    const returned = signature.getReturnType();
    const refusedOutput = notData(checker.getAwaitedType(returned) ?? returned, property.name, checker);
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
      ...(refusedOutput ? { notData: refusedOutput } : {}),
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
   * Base classes this pass could not open — an INSTALLED one, typically, whose source is not in
   * the workspace.
   */
  unresolved: string[],
): Signature[] {
  const ts = getTS();
  if (!cls.heritageClauses) return [];

  for (const clause of cls.heritageClauses) {
    if (clause.token !== ts.SyntaxKind.ExtendsKeyword) continue;

    for (const base of clause.types) {
      const fromType = inheritedFromBase(base, checker, skip);
      if (fromType.length > 0) return fromType;
      // Core's `Repository` brings what it declares (`__ops`), and none of its source is to be read.
      if (isCoreRepository(base, checker)) continue;

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

/** What a handler file yielded — its methods, AND what the pass could not open. */
export interface HandlerParse {
  methods: Signature[];
  /** Base classes whose source this pass could not open. Empty is a claim. */
  unresolvedHeritage: string[];
}

export function parseClassMethods(
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
