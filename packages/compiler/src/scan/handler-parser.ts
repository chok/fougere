/** Handler signature parser — extracts method signatures from handler source files. */
import { type Param, type Signature, type DeclaredAnswer } from '@fougere/core/descriptor';
import { type ErrorCode } from '@fougere/core';
import { refusalsIn } from './refusals.js';
import { loadTS, checkedSourceOf, findDefaultClass, projectOf } from './TypeProgram.js';
import { parsedParam } from './typeRef.js';
import { parseClassMethods, type HandlerParse } from './classes.js';

export type { HandlerParse } from './classes.js';

/**
 * Every method a handler declares, its inherited ones included — the raw material of a
 * binding plan. With a `projectRoot`, the heritage clause is followed too.
 */
export async function parseAllHandlerMethods(filePath: string, projectRoot?: string): Promise<HandlerParse> {
  await loadTS();

  return parseClassMethods(filePath, CONSTRUCTOR_ONLY, projectRoot);
}

/**
 * What every operation of a file's program can refuse, walked from the refusals upward.
 *
 * It reads the SAME program the signatures came from, so nothing is opened twice and a
 * dependency resolves through the checker rather than by name.
 */
export async function parseRefusals(
  filePath: string,
  isOperation: (name: string) => boolean,
  projectRoot?: string,
): Promise<Map<string, ErrorCode[]>> {
  const typescript = await loadTS();
  const { program } = projectOf(filePath, projectRoot);
  const { byMethod } = refusalsIn(typescript, program, isOperation);

  return new Map([...byMethod].map(([method, codes]) => [method, [...codes].sort()]));
}

/** Parse a presenter source file and extract all method signatures. */
export async function parsePresenterMethods(filePath: string, projectRoot?: string): Promise<Signature[]> {
  await loadTS();

  // No `projectRoot`, so no heritage pass and nothing to report: a presenter's
  // computed fields are its own methods.
  return parseClassMethods(filePath, CONSTRUCTOR_ONLY, undefined, projectRoot).methods;
}

/**
 * Parse constructor parameter types from a source file's default class.
 * Returns type names (e.g. ['PostStorage', 'Logger']) for DI resolution.
 */
export async function parseConstructorParams(filePath: string, projectRoot?: string): Promise<Param[]> {
  const ts = await loadTS();
  const { source, checker } = checkedSourceOf(filePath, projectRoot);
  const cls = findDefaultClass(source);
  if (!cls) return [];

  const ctor = cls.members.find(ts.isConstructorDeclaration);

  return ctor ? ctor.parameters.map((p) => parsedParam(p, source, checker)) : [];
}

const CONSTRUCTOR_ONLY = new Set(['constructor']);

/**
 * What each method of a door middleware declares it may answer, read off its return type: every
 * member whose `status` is a number LITERAL, with the keys of its `headers`. A member whose status
 * is `number` is the answer `next()` hands back, not a declaration. The fields are read, never the
 * type arguments, so the reading holds behind any alias.
 */
export async function parseDeclaredAnswers(filePath: string, projectRoot?: string): Promise<Map<string, DeclaredAnswer[]>> {
  const ts = await loadTS();
  const { source, checker } = checkedSourceOf(filePath, projectRoot);
  const cls = findDefaultClass(source);
  const declared = new Map<string, DeclaredAnswer[]>();
  if (!cls) return declared;

  for (const member of cls.members) {
    if (!ts.isMethodDeclaration(member) || !member.name || !ts.isIdentifier(member.name)) continue;
    const signature = checker.getSignatureFromDeclaration(member);
    if (!signature) continue;

    const returned = checker.getReturnTypeOfSignature(signature);
    const awaited = checker.getAwaitedType(returned) ?? returned;
    const answers = (awaited.isUnion() ? awaited.types : [awaited]).flatMap((one) => {
      const status = one.getProperty('status');
      if (!status) return [];
      const statusType = checker.getTypeOfSymbolAtLocation(status, member);
      const codes = (statusType.isUnion() ? statusType.types : [statusType]).flatMap((code) => (code.isNumberLiteral() ? [code.value] : []));
      const headersSymbol = one.getProperty('headers');
      const headers = headersSymbol
        ? checker.getPropertiesOfType(checker.getNonNullableType(checker.getTypeOfSymbolAtLocation(headersSymbol, member))).map((key) => key.name)
        : [];

      return codes.map((code) => ({ status: code, headers }));
    });
    if (answers.length > 0) declared.set(member.name.text, answers);
  }

  return declared;
}
