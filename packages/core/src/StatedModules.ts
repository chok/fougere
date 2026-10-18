/**
 * The fronds a config names by MODULE rather than by directory — `@fougere/log`, or a package
 * of your own. Reading one means importing it, which is why this lives on the node entry and
 * never on the one a Worker runs.
 *
 * What a module hands back decides where it goes: a shape stating `up`, `down` or `state` is an
 * extension and rises with the app, anything else is a frond and is installed like the rest.
 * The author of a config does not have to know which one their package exports — the same
 * reading `extensions/` already does off a module's form.
 *
 * A frond the config BUILT in place — `auth: betterAuth({ … })` — is handed over the same way,
 * with nothing to import: the config file already did.
 */
import type { Extension } from './boot/Extension.js';
import type { FrondDescriptor } from './descriptor/FrondDescriptor.js';
import { isExtension } from './descriptor/ExtensionEntry.js';
import { statesModule, type FrondsStated } from './FrondsStated.js';
import { statedFronds } from './StatedFrond.js';
import { getModuleLoader, type ModuleLoader } from './loader.js';

/** The export a specifier reaches: its last segment, `default` failing that. */
function exportedBy(specifier: string): string {
  const last = specifier.split('/').at(-1) ?? specifier;

  return last.replace(/\.[cm]?[jt]s$/, '');
}

/** What a config hands over as code — its module keys and the fronds it built — sorted by what each one is. */
export async function statedModules(
  stated: FrondsStated | undefined,
  loader: ModuleLoader = getModuleLoader(),
): Promise<{ fronds: FrondDescriptor[]; extensions: Extension[] }> {
  const fronds: FrondDescriptor[] = [];
  const extensions: Extension[] = [];

  for (const entry of statedFronds(stated)) {
    if (entry.held) {
      if (entry.held.name !== entry.key) {
        throw new Error(
          `fougere.config.ts: the entry '${entry.path}' holds the frond '${entry.held.name}'. Rename the entry '${entry.held.name}'.`,
        );
      }
      fronds.push(entry.held);
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

    const built = (factory as (argument?: unknown) => unknown)(entry.value);
    if (isExtension(built)) extensions.push(built as Extension);
    else fronds.push(built as FrondDescriptor);
  }

  return { fronds, extensions };
}
