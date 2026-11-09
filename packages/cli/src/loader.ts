import { resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { resolveConventions } from '@fougere/core';
import { frondAliases, setModuleLoader, loadConfig } from '@fougere/core/node';
import type { Conventions } from '@fougere/core';

/** The loader every command needs, made from the project so a module key resolves there. */
export async function installLoader(root: string, reread = false): Promise<Conventions> {
  const { createJiti } = await import('jiti');
  const project = pathToFileURL(resolve(root) + sep).href;
  const bare = createJiti(project, { interopDefault: true });
  setModuleLoader((filePath) => bare.import(filePath) as Promise<Record<string, unknown>>);

  const conventions = resolveConventions((await loadConfig(root)).conventions);
  const jiti = createJiti(project, {
    interopDefault: true,
    alias: await frondAliases(root, conventions),
    ...(reread ? { moduleCache: false } : {}),
  });
  setModuleLoader((filePath) => jiti.import(filePath) as Promise<Record<string, unknown>>);

  return conventions;
}
