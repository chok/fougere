import type { CreateAppOptions } from './boot/CreateAppOptions.js';
import type { FrondDescriptor } from './descriptor/FrondDescriptor.js';
import { getModuleLoader } from './loader.js';

/** What a project boots from: its fronds as `frond()` calls, and the terms its process answers. */
export type Statement = Required<Pick<CreateAppOptions, 'fronds' | 'vocabulary'>>;

/** The statement a file holds — the `fronds.ts` a project wrote, or the one the scan wrote — narrowed to `only`. */
export async function statementIn(file: string, only?: readonly string[]): Promise<Statement> {
  const mod = await getModuleLoader()(file);
  const fronds = mod.default as FrondDescriptor[];

  return {
    fronds: only ? fronds.filter((frond) => only.includes(frond.name)) : fronds,
    vocabulary: (mod.vocabulary ?? []) as NonNullable<CreateAppOptions['vocabulary']>,
  };
}
