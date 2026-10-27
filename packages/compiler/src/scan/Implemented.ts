/** What a scanned class declares it implements. */
import type ts from '@typescript/typescript6';
import { loadTS, checkedSourceOf, findDefaultClass } from './TypeProgram.js';

/**
 * What a scanned class says it IMPLEMENTS, and whether each name is a class.
 *
 * A class is the interesting case: `implements` is erased, so `Object.getPrototypeOf(ctor).name`
 * is empty and the boot binds no port. An interface is the ordinary one — and one of them,
 * `AsyncDisposable`, is how a provider says its scope keeps it and closes it.
 */
export async function parseImplements(filePath: string, projectRoot?: string): Promise<Implemented[]> {
  const typescript = await loadTS();
  const { source, checker } = checkedSourceOf(filePath, projectRoot);
  const cls = findDefaultClass(source);
  if (!cls?.heritageClauses) return [];

  const found: Implemented[] = [];
  for (const clause of cls.heritageClauses) {
    if (clause.token !== typescript.SyntaxKind.ImplementsKeyword) continue;

    for (const base of clause.types) {
      // `implements Partial<Payment>` names the port inside `Partial`: a link writes only what it changes.
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
 * The port a class EXTENDS with a type argument — `extends Rest<NoteHandler>` — which the prototype
 * reads as `Rest` alone, so the scan states it whole: `Rest<NoteHandler>`. Four of core's bases are not
 * ports but seats (`Repository<Post>`, `Collect<User>`), read by `parseSeat`; `Env<Meili>` is a port.
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

/** Core's bases that SEAT a class on its entity rather than being a port — read by `parseSeat`. */
const SEATS = new Set(['Repository', 'Collect', 'Present', 'Mirror']);

/** Where core declares its own bases — a project's class of the same name is not one. */
const CORE = /[\\/](core[\\/](src|dist)|@fougere[\\/]core)[\\/]/;

/**
 * `Rest<NoteHandler>`, spelled as the type: a class name cannot hold a `<`, so no class of the frond
 * can take the key by its name.
 */
export const keyOf = (port: string, subject: string | undefined): string => (subject ? `${port}<${subject}>` : port);

/** The one type argument naming a subject — `NoteHandler` in `Rest<NoteHandler>`. */
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
