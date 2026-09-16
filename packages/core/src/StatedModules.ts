/**
 * The fronds a config names by MODULE rather than by directory — `@fougere/log`, or a package
 * of your own. Reading one means importing it, which is why this lives on the node entry and
 * never on the one a Worker runs.
 *
 * What a module hands back decides where it goes: a shape stating `up` or `down` is an
 * extension and rises with the app, anything else is a frond and is installed like the rest.
 * The author of a config does not have to know which one their package exports — the same
 * reading `extensions/` already does off a module's form.
 */
import type { Extension } from './boot/Extension.js';
import type { FrondDescriptor } from './descriptor/FrondDescriptor.js';
import { statesModule, type FrondsStated } from './FrondsStated.js';
import { statedFronds } from './StatedFrond.js';
import { getModuleLoader } from './loader.js';

/** The export a specifier reaches: its last segment, `default` failing that. */
function exportedBy(specifier: string): string {
  const last = specifier.split('/').at(-1) ?? specifier;

  return last.replace(/\.[cm]?[jt]s$/, '');
}

function rises(built: unknown): built is Extension {
  const shape = built as { up?: unknown; down?: unknown } | null;

  return typeof shape?.up === 'function' || typeof shape?.down === 'function';
}

/** What a config's module keys hand over, sorted by what each one turned out to be. */
export async function statedModules(
  stated: FrondsStated | undefined,
): Promise<{ fronds: FrondDescriptor[]; extensions: Extension[] }> {
  const fronds: FrondDescriptor[] = [];
  const extensions: Extension[] = [];
  const loader = getModuleLoader();

  for (const entry of statedFronds(stated)) {
    if (!statesModule(entry.key)) continue;

    const module = await loader(entry.key) as Record<string, unknown>;
    const name = exportedBy(entry.key);
    const factory = module[name] ?? module.default;
    if (typeof factory !== 'function') {
      throw new Error(
        `Fougere config: '${entry.key}' exports no '${name}'. A module a config names hands its `
        + `frond back from the export its last segment spells — \`export const ${name} = …\` — or `
        + 'from its default.',
      );
    }

    const built = (factory as (argument?: unknown) => unknown)(entry.value);
    if (rises(built)) extensions.push(built);
    else fronds.push(built as FrondDescriptor);
  }

  return { fronds, extensions };
}
