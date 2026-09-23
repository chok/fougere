import { resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { frondAliases } from '@fougere/compiler';
import { resolveConventions } from '@fougere/core';
import { setModuleLoader, loadConfig } from '@fougere/core/node';
import type { Conventions } from '@fougere/core';

/**
 * The loader every command needs — made FROM the project, since a module key (`'@fougere/log'`)
 * is resolved against whoever made the loader: made here, it looked in the CLI's own
 * dependencies and never in the project's.
 */
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
