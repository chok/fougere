/** The entities a class is built on, read off `Repository<…>`, `Collect<…>` or `Present<…>` where TypeScript erases them. */
import type ts from '@typescript/typescript6';
import { loadTS, checkedSourceOf, findDefaultClass } from './TypeProgram.js';

/** One type argument of `Repository<…>`: the class it names, and the file declaring it. */
export interface Seat {
  /** The class's own name, as its declaration spells it. */
  name: string;
  /** The export it is reached by — `default` for `export default class Post`. */
  exported: string;
  filePath: string;
}

/** Where core declares the base — so a project's own class named `Repository` is not taken for it. */
const CORE = /[\\/](core[\\/](src|dist)|@fougere[\\/]core)[\\/]/;

/**
 * The entities a scanned class names on `Repository<Post>` — climbing its bases, so `PostHandler
 * extends PostRepository extends Repository<Post>` answers `Post` — or none for a class not built
 * on it. The arguments are read in order, `never` left out: `Repository<Account, Ledger>` is two.
 */
export async function parseSeat(filePath: string, projectRoot?: string, base: 'Repository' | 'Collect' | 'Present' = 'Repository'): Promise<Seat[]> {
  const typescript = await loadTS();
  const { source, checker } = checkedSourceOf(filePath, projectRoot);
  const written = findDefaultClass(source);
  const symbol = written?.name ? checker.getSymbolAtLocation(written.name) : undefined;
  if (!symbol) return [];

  // Climbing a generic base — `PartnerCatalog extends Mirror<BookCard>`, `Mirror<T> extends
  // Repository<T>` — the checker hands back `Repository<T>`, so what each parameter stands for is
  // carried up the chain.
  const visited = new Set<ts.Type>();
  let bound = new Map<ts.Type, ts.Type>();
  for (let type: ts.Type | undefined = checker.getDeclaredTypeOfSymbol(symbol); type && !visited.has(type);) {
    visited.add(type);
    const [above] = checker.getBaseTypes(type as ts.InterfaceType);
    if (!above) return [];
    const written = checker.getTypeArguments(above as ts.TypeReference).map((argument) => bound.get(argument) ?? argument);
    if (isCoreBase(above, base)) return seatsIn(typescript, written);
    const target = (above as ts.TypeReference).target ?? above;
    const parameters = (target as ts.InterfaceType).typeParameters ?? [];
    bound = new Map(parameters.map((parameter, i) => [parameter, written[i]!] as const).filter(([, argument]) => argument));
    type = target;
  }

  return [];
}

function isCoreBase(type: ts.Type, base: string): boolean {
  const symbol = type.getSymbol();

  return symbol?.name === base
    && (symbol.declarations ?? []).some((one) => CORE.test(one.getSourceFile().fileName));
}

function seatsIn(typescript: typeof ts, written: readonly ts.Type[]): Seat[] {
  return written
    .filter((argument) => !(argument.flags & typescript.TypeFlags.Never))
    .flatMap((argument) => {
      const named = argument.getSymbol();
      const declared = named?.declarations?.[0];
      if (!named || !declared) return [];
      const written = (declared as { name?: ts.Identifier }).name?.text ?? named.name;

      return [{ name: written, exported: named.name, filePath: declared.getSourceFile().fileName }];
    });
}
