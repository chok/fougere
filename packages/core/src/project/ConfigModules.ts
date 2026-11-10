import type { Extension } from '../boot/Extension.js';
import type { FrondDescriptor } from '../descriptor/FrondDescriptor.js';
import { isExtension } from '../descriptor/ExtensionEntry.js';
import { statesModule, type FrondEntries } from '../config/FrondEntries.js';
import { keyedFrondEntries } from '../config/KeyedFrondEntry.js';
import { getModuleLoader, type ModuleLoader } from '../loader.js';

function exportedBy(specifier: string): string {
  const last = specifier.split('/').at(-1) ?? specifier;

  return last.replace(/\.[cm]?[jt]s$/, '');
}

/** What a config hands over as code — its module keys and the fronds it built — sorted by what each one is. */
export async function configModules(
  entries: FrondEntries | undefined,
  loader: ModuleLoader = getModuleLoader(),
): Promise<{ fronds: FrondDescriptor[]; extensions: Extension[] }> {
  const fronds: FrondDescriptor[] = [];
  const extensions: Extension[] = [];

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
    if (isExtension(exported)) extensions.push(exported as Extension);
    else fronds.push(exported as FrondDescriptor);
  }

  return { fronds, extensions };
}
