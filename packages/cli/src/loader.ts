import {
  setModuleLoader, loadConfig, resolveConventions, frondAliases,
} from '@fougere/core/node';
import type { Conventions } from '@fougere/core/node';

/** The loader every command needs: */
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
