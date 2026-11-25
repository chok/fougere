import type { FrondDescriptor } from '../descriptor/FrondDescriptor.js';
import { isExtension } from '../descriptor/ExtensionEntry.js';
import { statesModule, statesPackage, type FrondEntries } from '../config/FrondEntries.js';
import { keyedFrondEntries } from '../config/KeyedFrondEntry.js';
import { getModuleLoader, type ModuleLoader } from '../loader.js';

function exportedBy(specifier: string): string {
  const last = specifier.split('/').at(-1) ?? specifier;

  return last.replace(/\.[cm]?[jt]s$/, '');
}

/** The fronds a config hands over as code: its module keys and the fronds it built. An extension under `fronds:` refuses. */
export async function configModules(
  entries: FrondEntries | undefined,
  loader: ModuleLoader = getModuleLoader(),
): Promise<{ fronds: FrondDescriptor[] }> {
  const fronds: FrondDescriptor[] = [];

  for (const entry of keyedFrondEntries(entries)) {
    if (entry.descriptor) {
      if (entry.descriptor.name !== entry.key) {
        throw new Error(
          `fougere.config.ts: the entry '${entry.path}' holds the frond '${entry.descriptor.name}'. Rename the entry '${entry.descriptor.name}'.`,
        );
      }
      fronds.push(entry.descriptor);
      continue;
    }
    if (!statesModule(entry.key)) continue;

    const module = await loader(entry.key) as Record<string, unknown>;
    const name = exportedBy(entry.key);
    const factory = module[name] ?? module.default;
    if (typeof factory !== 'function') {
      throw new Error(
        `fougere.config.ts: '${entry.key}' has no export named ${name} and no default export. `
        + `It should export one: export const ${name} = …`,
      );
    }

    const exported = (factory as (argument?: unknown) => unknown)(entry.value);
    if (isExtension(exported)) {
      const argument = entry.value === undefined ? '' : `'${entry.value}'`;
      throw new Error(
        `fougere.config.ts: '${entry.key}' is an extension, which a process carries, not a frond. `
        + `Move it to platform: — import { ${name} } from '${entry.key}', then platform: [${name}(${argument})].`,
      );
    }
    if (statesPackage(entry.key)) fronds.push({ ...(exported as FrondDescriptor), name: entry.key });
    else fronds.push(exported as FrondDescriptor);
  }

  return { fronds };
}
