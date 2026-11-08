import { type Param, type TypeRef } from '@fougere/core/descriptor';
import type ts from '@typescript/typescript6';
import { getTS } from './TypeProgram.js';

/** One declared parameter — a constructor's and a method's are read the same way. */
export function parsedParam(param: ts.ParameterDeclaration, source: ts.SourceFile, checker?: ts.TypeChecker): Param {
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

/** The transparent markers, kept by NAME because the checker keeps nothing of them. */
const ANNOUNCED = new Set(['Fact', 'Pipe']);

/** Parse a TypeScript type node into a TypeRef. */
export function parseTypeNode(node: ts.TypeNode, source: ts.SourceFile, checker?: ts.TypeChecker): TypeRef {
  const parsed = readTypeNode(node, source, checker);
  const field = fieldOf(node);

  return field ? { ...parsed, field } : parsed;
}

function readTypeNode(node: ts.TypeNode, source: ts.SourceFile, checker?: ts.TypeChecker): TypeRef {
  const ts = getTS();
  const raw = node.getText(source);

  if (checker) return announced(node, source, checker) ?? parseCheckedType(checker.getTypeFromTypeNode(node), raw, checker);

  if (ts.isUnionTypeNode(node)) return fromUnion(node, source, raw);
  if (ts.isTypeReferenceNode(node)) return fromReference(node, source, raw);
  if (ts.isArrayTypeNode(node)) {
    const inner = parseTypeNode(node.elementType, source);

    return { ...inner, array: true, arrayDepth: (inner.arrayDepth ?? 0) + 1, raw };
  }

  return fromKeyword(node, raw) ?? { raw, name: raw };
}

/**
 * `Post['title']` names where the type comes from, which the checker forgets once it answers
 * `string`. Read from the syntax; the scan then says whether it designates a row.
 */
function fieldOf(node: ts.TypeNode): TypeRef['field'] {
  const ts = getTS();
  if (!ts.isIndexedAccessTypeNode(node)) return undefined;
  const { objectType, indexType } = node;
  if (!ts.isTypeReferenceNode(objectType) || !ts.isIdentifier(objectType.typeName)) return undefined;
  if (!ts.isLiteralTypeNode(indexType) || !ts.isStringLiteral(indexType.literal)) return undefined;

  return { entity: objectType.typeName.text, name: indexType.literal.text };
}

/**
 * `Fact<T>` and `Pipe<T>` are deliberately transparent in TypeScript (`= T`), because both
 * receive the payload itself — one reads it, the other answers the value every reader then gets.
 * The checker erases the marker, while the binding plan still needs it to tell either from an
 * ordinary body.
 */
function announced(node: ts.TypeNode, source: ts.SourceFile, checker: ts.TypeChecker): TypeRef | undefined {
  const ts = getTS();
  if (!ts.isTypeReferenceNode(node) || !ts.isIdentifier(node.typeName) || !ANNOUNCED.has(node.typeName.text)) {
    return undefined;
  }

  return {
    raw: node.getText(source),
    name: node.typeName.text,
    generics: node.typeArguments?.map((arg) => parseTypeNode(arg, source, checker)) ?? [],
  };
}

/** `T | null`, `T | undefined`, `T | void` — the absence is an axis, the rest is the type. */
function fromUnion(node: ts.UnionTypeNode, source: ts.SourceFile, raw: string): TypeRef {
  const ts = getTS();
  const isNull = (one: ts.TypeNode) =>
    (ts.isLiteralTypeNode(one) && one.literal.kind === ts.SyntaxKind.NullKeyword)
    || one.kind === ts.SyntaxKind.NullKeyword;
  const isAbsent = (one: ts.TypeNode) =>
    one.kind === ts.SyntaxKind.UndefinedKeyword || one.kind === ts.SyntaxKind.VoidKeyword;

  const nullable = node.types.some(isNull);
  const undefinable = node.types.some(isAbsent);
  const nonNull = node.types.filter((one) => !isNull(one) && !isAbsent(one));

  if (nonNull.length !== 1) return { raw, name: raw, nullable, undefined: undefinable };

  const inner = parseTypeNode(nonNull[0]!, source);

  return { ...inner, nullable: nullable || inner.nullable, undefined: undefinable || inner.undefined, raw };
}

/** `Promise<T>` and `Array<T>` are carriers; anything else keeps its name and its generics. */
function fromReference(node: ts.TypeReferenceNode, source: ts.SourceFile, raw: string): TypeRef {
  const typeName = node.typeName.getText(source);

  if (typeName === 'Promise' && node.typeArguments?.length === 1) {
    return { ...parseTypeNode(node.typeArguments[0]!, source), promise: true, raw };
  }

  if (typeName === 'Array' && node.typeArguments?.length === 1) {
    const inner = parseTypeNode(node.typeArguments[0]!, source);

    return { ...inner, array: true, arrayDepth: (inner.arrayDepth ?? 0) + 1, raw };
  }

  if (node.typeArguments && node.typeArguments.length > 0) {
    return { raw, name: typeName, generics: node.typeArguments.map((arg) => parseTypeNode(arg, source)) };
  }

  return { raw, name: typeName };
}

function fromKeyword(node: ts.TypeNode, raw: string): TypeRef | undefined {
  const ts = getTS();
  switch (node.kind) {
    case ts.SyntaxKind.StringKeyword: return { raw, name: 'string' };
    case ts.SyntaxKind.NumberKeyword: return { raw, name: 'number' };
    case ts.SyntaxKind.BooleanKeyword: return { raw, name: 'boolean' };
    case ts.SyntaxKind.VoidKeyword: return { raw, name: 'void', undefined: true };
    case ts.SyntaxKind.UndefinedKeyword: return { raw, name: 'undefined', undefined: true };
    case ts.SyntaxKind.NullKeyword: return { raw, name: 'null', nullable: true };
    case ts.SyntaxKind.AnyKeyword: return { raw, name: 'any' };
    case ts.SyntaxKind.UnknownKeyword: return { raw, name: 'unknown' };
    default: return undefined;
  }
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
export function parseCheckedType(type: ts.Type, raw: string, checker: ts.TypeChecker, depth = 0): TypeRef {
  if (depth > 12) return { raw, name: checker.typeToString(type) };

  if (type.isUnion()) return fromCheckedUnion(type, raw, checker, depth);

  // Present at runtime in the supported compiler versions, but intentionally omitted from
  // TypeScript's public TypeChecker declaration.
  const promised = (checker as ts.TypeChecker & {
    getPromisedTypeOfPromise(candidate: ts.Type): ts.Type | undefined;
  }).getPromisedTypeOfPromise(type);
  if (promised) return { ...parseCheckedType(promised, raw, checker, depth + 1), raw, promise: true };

  if (checker.isArrayType(type)) {
    const [element] = checker.getTypeArguments(type as ts.TypeReference);
    const inner = element ? parseCheckedType(element, raw, checker, depth + 1) : { raw, name: 'unknown' };

    return { ...inner, raw, array: true, arrayDepth: (inner.arrayDepth ?? 0) + 1 };
  }

  const primitive = fromCheckedFlags(type.flags, raw);
  if (primitive) return primitive;

  // A declared alias such as `Emit<PostPublished>` may reduce to a function or object type, so it
  // is no longer a TypeReference. The checker keeps its arguments beside `aliasSymbol`; losing
  // them turns DI keys into bare `Emit`/`Facade`.
  const args = (type as ts.Type & { aliasTypeArguments?: readonly ts.Type[] }).aliasTypeArguments
    ?? checker.getTypeArguments(type as ts.TypeReference);

  return {
    raw,
    name: meaningfulSymbolName(type, checker),
    ...(args.length && { generics: args.map((arg) => parseCheckedType(arg, checker.typeToString(arg), checker, depth + 1)) }),
  };
}

/**
 * What an operation ANSWERS is read here, and the question asked of it is whether it is data.
 *
 * Data is what JSON keeps, so every node is asked one thing: can something in it be CALLED? A
 * `Date` carries `toString`, a `Map` carries `clear`, an Effect carries `pipe`. Measured
 * 2026-09-18 over the facade's own exit: `{ at: new Date(0) }` reaches a local caller as a `Date`
 * and a remote one as a string, and an object with methods loses them on both sides, differently.
 *
 * It answers the PATH and the type sitting there — `at: Date` reads as the declaration it came
 * from, where the first callable member (`toString`) names nothing an author wrote. `any` and
 * `unknown` are left alone: nothing was declared to judge.
 *
 * Documented: [handlers](https://fougere.dev/docs/concepts/handler).
 */
export function notData(
  type: ts.Type,
  path: string,
  checker: ts.TypeChecker,
  seen = new Set<ts.Type>(),
): string | undefined {
  const typescript = getTS();
  if (seen.has(type)) return undefined;

  const judged = typescript.TypeFlags.Any | typescript.TypeFlags.Unknown | typescript.TypeFlags.Never
    | typescript.TypeFlags.StringLike | typescript.TypeFlags.NumberLike | typescript.TypeFlags.BooleanLike
    | typescript.TypeFlags.BigIntLike | typescript.TypeFlags.Null | typescript.TypeFlags.Undefined
    | typescript.TypeFlags.Void;
  if (type.flags & judged) return undefined;

  if (type.isUnion() || type.isIntersection()) return firstRefused(type.types, (member) => notData(member, path, checker, seen));

  if (type.getCallSignatures().length > 0) return `${path}: ${checker.typeToString(type)}`;
  if (declaresShape(type)) return undefined;

  seen.add(type);

  const items = itemsOf(type, checker);
  if (items) return firstRefused(items, (item) => notData(item, `${path}[]`, checker, seen));

  return firstRefused(checker.getPropertiesOfType(type), (property) => {
    const held = checker.getTypeOfSymbol(property);
    // A symbol key never survives JSON either, and it is how an iterable declares itself.
    if (property.escapedName.toString().startsWith('__@') || held.getCallSignatures().length > 0) {
      return `${path}: ${checker.typeToString(type)}`;
    }

    return notData(held, `${path}.${property.name}`, checker, seen);
  });
}

/**
 * A class the schema declares — `extends entity({…})`, or a projection of one.
 *
 * Read from the HERITAGE rather than from what `resolveSchema` resolved: a frond answering with
 * an entity its neighbour declares (a `Pipe<PostPublished>` finishing a fact) has no schema in
 * its own module exports, so the op carries no output and would be judged as if nothing
 * converted it. Its fields do convert it, wherever the class was written.
 */
function declaresShape(type: ts.Type): boolean {
  const typescript = getTS();

  return (type.getSymbol()?.declarations ?? []).some((declaration) =>
    typescript.isClassDeclaration(declaration)
    && (declaration.heritageClauses ?? []).some((clause) =>
      /entity\(|\.(pick|omit|partial|extend)\(/.test(clause.getText())));
}

/**
 * What a type holds if it is read as a list — its elements, or nothing.
 *
 * By its numeric INDEX and not by `isArrayType`: `ListResult<T> extends Array<T>` is a subtype,
 * so the array test says no and the walk reached `push` and `map` instead of the rows. What rides
 * beside the rows (`total`, `hasMore`) is data and is judged with everything else.
 */
function itemsOf(type: ts.Type, checker: ts.TypeChecker): readonly ts.Type[] | undefined {
  const typescript = getTS();
  if (checker.isArrayType(type) || checker.isTupleType(type)) {
    return checker.getTypeArguments(type as ts.TypeReference);
  }
  const numeric = checker.getIndexTypeOfType(type, typescript.IndexKind.Number);

  return numeric ? [numeric] : undefined;
}

function firstRefused<T>(members: readonly T[], read: (member: T) => string | undefined): string | undefined {
  for (const member of members) {
    const refused = read(member);
    if (refused) return refused;
  }

  return undefined;
}

/** The type an operation hands back, past the promise every dispatch awaits. */
export function answeredBy(signature: ts.Signature | undefined, checker: ts.TypeChecker): ts.Type | undefined {
  if (!signature) return undefined;
  const returned = signature.getReturnType();

  return checker.getAwaitedType(returned) ?? returned;
}

/** A union carries an absence on the side; what remains is the type. */
function fromCheckedUnion(type: ts.UnionType, raw: string, checker: ts.TypeChecker, depth: number): TypeRef {
  const typescript = getTS();
  const nullable = type.types.some((member) => (member.flags & typescript.TypeFlags.Null) !== 0);
  const undefinable = type.types.some((member) =>
    (member.flags & (typescript.TypeFlags.Undefined | typescript.TypeFlags.Void)) !== 0,
  );
  const members = type.types.filter((member) =>
    (member.flags & (typescript.TypeFlags.Null | typescript.TypeFlags.Undefined | typescript.TypeFlags.Void)) === 0,
  );

  // The checker represents the `boolean` keyword itself as `false | true`. Preserve the
  // primitive vocabulary consumed by binding and presenter metadata.
  const allBooleans = members.length > 0
    && members.every((member) => (member.flags & typescript.TypeFlags.BooleanLiteral) !== 0);
  if (allBooleans) return { raw, name: 'boolean', nullable, undefined: undefinable };

  if (members.length === 1) {
    const inner = parseCheckedType(members[0]!, raw, checker, depth + 1);

    return { ...inner, raw, nullable: nullable || inner.nullable, undefined: undefinable || inner.undefined };
  }

  const names = members.map((member) => meaningfulSymbolName(member, checker));

  return {
    raw,
    name: names.join(' | ') || raw,
    members: names,
    nullable,
    undefined: undefinable,
  };
}

/** The keywords, read off the flags the checker already carries. */
function fromCheckedFlags(flags: ts.TypeFlags, raw: string): TypeRef | undefined {
  const typescript = getTS();
  if ((flags & typescript.TypeFlags.StringLike) !== 0) return { raw, name: 'string' };
  if ((flags & typescript.TypeFlags.NumberLike) !== 0) return { raw, name: 'number' };
  if ((flags & typescript.TypeFlags.BooleanLike) !== 0) return { raw, name: 'boolean' };
  if ((flags & typescript.TypeFlags.Void) !== 0) return { raw, name: 'void', undefined: true };
  if ((flags & typescript.TypeFlags.Undefined) !== 0) return { raw, name: 'undefined', undefined: true };
  if ((flags & typescript.TypeFlags.Null) !== 0) return { raw, name: 'null', nullable: true };
  if ((flags & typescript.TypeFlags.Any) !== 0) return { raw, name: 'any' };
  if ((flags & typescript.TypeFlags.Unknown) !== 0) return { raw, name: 'unknown' };

  return undefined;
}
