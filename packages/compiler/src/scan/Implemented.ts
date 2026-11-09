/** What a scanned class declares it implements. */
import type ts from '@typescript/typescript6';
import { loadTS, checkedSourceOf, findDefaultClass } from './TypeProgram.js';

/** What a scanned class implements, and whether each name is a class. */
export async function parseImplements(filePath: string, projectRoot?: string): Promise<Implemented[]> {
  const typescript = await loadTS();
  const { source, checker } = checkedSourceOf(filePath, projectRoot);
  const cls = findDefaultClass(source);
  if (!cls?.heritageClauses) return [];

  const found: Implemented[] = [];
  for (const clause of cls.heritageClauses) {
    if (clause.token !== typescript.SyntaxKind.ImplementsKeyword) continue;

    for (const base of clause.types) {
      const partial = typescript.isIdentifier(base.expression) && base.expression.text === 'Partial';
      const argument = partial ? base.typeArguments?.[0] : undefined;
      const written = argument && typescript.isTypeReferenceNode(argument) && typescript.isIdentifier(argument.typeName)
        ? { named: argument.typeName, subject: subjectIn(typescript, argument.typeArguments) }
        : { named: base.expression, subject: subjectIn(typescript, base.typeArguments) };
      if (!typescript.isIdentifier(written.named)) continue;

      found.push({ name: keyOf(written.named.text, written.subject), isClass: isClass(typescript, checker, written.named), partial });
    }
  }

  return found;
}

/**
 * The port a class extends with a type argument, as the type is written.
 * Ex: `extends Rest<NoteHandler>` → `Rest<NoteHandler>`.
 */
export async function parseExtendedPort(filePath: string, projectRoot?: string): Promise<Implemented | undefined> {
  const typescript = await loadTS();
  const { source, checker } = checkedSourceOf(filePath, projectRoot);
  const clause = findDefaultClass(source)?.heritageClauses?.find((one) => one.token === typescript.SyntaxKind.ExtendsKeyword);
  const base = clause?.types[0];
  const subject = subjectIn(typescript, base?.typeArguments);
  if (!base || !subject || !typescript.isIdentifier(base.expression)) return undefined;
  const symbol = resolved(typescript, checker, base.expression);
  const seat = SEATS.has(base.expression.text) && symbol?.declarations?.some((one) => CORE.test(one.getSourceFile().fileName));
  if (seat) return undefined;

  return { name: keyOf(base.expression.text, subject), isClass: isClass(typescript, checker, base.expression), partial: false };
}

const SEATS = new Set(['Repository', 'Collect', 'Present', 'Mirror']);

const CORE = /[\\/](core[\\/](src|dist)|@fougere[\\/]core)[\\/]/;

/**
 * A port key spelled as the type.
 * Ex: `keyOf('Rest', 'NoteHandler')` → `Rest<NoteHandler>`.
 */
export const keyOf = (port: string, subject: string | undefined): string => (subject ? `${port}<${subject}>` : port);

function subjectIn(typescript: typeof ts, args: readonly ts.TypeNode[] | undefined): string | undefined {
  const [first] = args ?? [];

  return args?.length === 1 && first && typescript.isTypeReferenceNode(first) && typescript.isIdentifier(first.typeName) ? first.typeName.text : undefined;
}

function resolved(typescript: typeof ts, checker: ts.TypeChecker, name: ts.Identifier): ts.Symbol | undefined {
  const symbol = checker.getSymbolAtLocation(name);

  return symbol && symbol.flags & typescript.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol;
}

function isClass(typescript: typeof ts, checker: ts.TypeChecker, name: ts.Identifier): boolean {
  return resolved(typescript, checker, name)?.declarations?.some((one) => typescript.isClassDeclaration(one)) ?? false;
}

/** One `implements` clause, and what the checker says its name is. */
export interface Implemented {
  name: string;
  isClass: boolean;
  /** Written `implements Partial<X>`: what it leaves out is X's, handed over to `inner`. */
  partial: boolean;
}
