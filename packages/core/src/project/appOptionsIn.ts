import type { CreateAppOptions } from '../boot/CreateAppOptions.js';
import type { FrondDescriptor } from '../descriptor/FrondDescriptor.js';
import { getModuleLoader } from '../loader.js';

/** The fronds and the vocabulary a file holds — the `fronds.ts` a project wrote, or the one the scan wrote — narrowed to `only`. */
export async function appOptionsIn(file: string, only?: readonly string[]): Promise<Required<Pick<CreateAppOptions, 'fronds' | 'vocabulary'>>> {
  const mod = await getModuleLoader()(file);
  const fronds = mod.default as FrondDescriptor[];

  return {
    fronds: only ? fronds.filter((frond) => only.includes(frond.name)) : fronds,
    vocabulary: (mod.vocabulary ?? []) as NonNullable<CreateAppOptions['vocabulary']>,
  };
}
