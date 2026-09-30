import { loadTS, sourceOf, findDefaultClass } from './TypeProgram.js';

/**
 * Whether a scanned class is `abstract` — erased at runtime, so only the source can say it.
 *
 * Such a class is a port and never a realization: the class below it answers under its name,
 * and nothing may instantiate it in that one's place.
 */
export async function parseAbstract(filePath: string): Promise<boolean> {
  const ts = await loadTS();

  return findDefaultClass(sourceOf(filePath))?.modifiers?.some((one) => one.kind === ts.SyntaxKind.AbstractKeyword) ?? false;
}
