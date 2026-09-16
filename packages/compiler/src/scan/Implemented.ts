/** What a scanned class declares it implements. */
import { loadTS, checkedSourceOf, findDefaultClass } from './TypeProgram.js';

/**
 * What a scanned class says it IMPLEMENTS, and whether each name is a class.
 *
 * A class is the interesting case: `implements` is erased, so `Object.getPrototypeOf(ctor).name`
 * is empty and the boot binds no port. An interface is the ordinary one — and one of them,
 * `AsyncDisposable`, is how a provider says its scope keeps it and closes it.
 */
export async function parseImplements(filePath: string, projectRoot?: string): Promise<Implemented[]> {
  const ts = await loadTS();
  const { source, checker } = checkedSourceOf(filePath, projectRoot);
  const cls = findDefaultClass(source);
  if (!cls?.heritageClauses) return [];

  const found: Implemented[] = [];
  for (const clause of cls.heritageClauses) {
    if (clause.token !== ts.SyntaxKind.ImplementsKeyword) continue;

    for (const base of clause.types) {
      if (!ts.isIdentifier(base.expression)) continue;

      let symbol = checker.getSymbolAtLocation(base.expression);
      if (symbol && symbol.flags & ts.SymbolFlags.Alias) symbol = checker.getAliasedSymbol(symbol);

      found.push({
        name: base.expression.text,
        isClass: symbol?.declarations?.some((one) => ts.isClassDeclaration(one)) ?? false,
      });
    }
  }

  return found;
}

/** One `implements` clause, and what the checker says its name is. */
export interface Implemented {
  name: string;
  isClass: boolean;
}
