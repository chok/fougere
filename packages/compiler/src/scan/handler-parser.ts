/** Handler signature parser — extracts method signatures from handler source files. */
import { type Param, type Signature, type DeclaredAnswer } from '@fougere/core/descriptor';
import { type ErrorCode } from '@fougere/core';
import { refusalsIn } from './refusals.js';
import { loadTS, checkedSourceOf, findDefaultClass, projectOf } from './TypeProgram.js';
import { parsedParam } from './typeRef.js';
import { parseClassMethods, type HandlerParse } from './classes.js';

export type { HandlerParse } from './classes.js';

/** Every method a handler declares, inherited ones included when `projectRoot` is given. */
export async function parseAllHandlerMethods(filePath: string, projectRoot?: string): Promise<HandlerParse> {
  await loadTS();

  return parseClassMethods(filePath, CONSTRUCTOR_ONLY, projectRoot);
}

/** What each operation of a file's program can refuse. */
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

  return parseClassMethods(filePath, CONSTRUCTOR_ONLY, undefined, projectRoot).methods;
}

/** The parameters of the constructor of a file's default class. */
export async function parseConstructorParams(filePath: string, projectRoot?: string): Promise<Param[]> {
  const ts = await loadTS();
  const { source, checker } = checkedSourceOf(filePath, projectRoot);
  const cls = findDefaultClass(source);
  if (!cls) return [];

  const ctor = cls.members.find(ts.isConstructorDeclaration);

  return ctor ? ctor.parameters.map((p) => parsedParam(p, source, checker)) : [];
}

const CONSTRUCTOR_ONLY = new Set(['constructor']);

/** What each method of a door link declares it may answer: every `status` literal, with its `headers` keys. */
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
