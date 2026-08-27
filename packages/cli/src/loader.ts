import {
  setModuleLoader, loadConfig, resolveConventions, frondAliases,
} from '@fougere/core/node';
import type { Conventions } from '@fougere/core/node';

/**
 * The loader every command needs: `alias` is what makes `@fronds/user/entities/User.js`
 * resolve when one frond names its neighbour, in any command that loads user code.
 *
 * Two jitis, because the config is read BEFORE the aliases — it names the scope they are
 * built from. `reread` drops the module cache: every loader caches by specifier, so a
 * second boot in one process would be handed what the first one read.
 */
export async function installLoader(root: string, reread = false): Promise<Conventions> {
  const { createJiti } = await import('jiti');
  const bare = createJiti(import.meta.url, { interopDefault: true });
  setModuleLoader((filePath) => bare.import(filePath) as Promise<Record<string, unknown>>);

  const conventions = resolveConventions((await loadConfig(root)).conventions);
  const jiti = createJiti(import.meta.url, {
    interopDefault: true,
    alias: await frondAliases(root, conventions),
    ...(reread ? { moduleCache: false } : {}),
  });
  setModuleLoader((filePath) => jiti.import(filePath) as Promise<Record<string, unknown>>);

  return conventions;
}
