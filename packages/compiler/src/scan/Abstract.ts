import { loadTS, sourceOf, findDefaultClass } from './TypeProgram.js';

/** Whether a scanned class is `abstract`, which TypeScript erases. */
export async function parseAbstract(filePath: string): Promise<boolean> {
  const ts = await loadTS();

  return findDefaultClass(sourceOf(filePath))?.modifiers?.some((one) => one.kind === ts.SyntaxKind.AbstractKeyword) ?? false;
}
