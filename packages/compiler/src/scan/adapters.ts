import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const ADAPTER_PACKAGE = /^@fougere\/adapter-(.+)$/;

/** The adapter names this project depends on — empty when it has no package.json to read. */
export async function adaptersOf(root: string): Promise<string[]> {
  const manifest = await read(join(root, 'package.json'));
  if (!manifest) return [];

  const declared = { ...manifest.dependencies, ...manifest.devDependencies };

  return Object.keys(declared)
    .map((name) => ADAPTER_PACKAGE.exec(name)?.[1])
    .filter((name): name is string => name !== undefined);
}

async function read(path: string): Promise<Manifest | undefined> {
  try {
    return JSON.parse(await readFile(path, 'utf8')) as Manifest;
  } catch {
    return undefined;
  }
}

interface Manifest {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}
