import { dirname, isAbsolute, join } from 'node:path';
import { existsSync, readFileSync } from 'node:fs';

const packageNames = new Map<string, string | undefined>();

/** The name of the package a file sits in — read off the nearest `package.json`, once per directory. */
function packageNameOf(directory: string): string | undefined {
  if (packageNames.has(directory)) return packageNames.get(directory);

  const manifest = join(directory, 'package.json');
  const parent = dirname(directory);
  const stated = existsSync(manifest) ? (JSON.parse(readFileSync(manifest, 'utf8')) as { name?: string }).name : undefined;
  const name = stated ?? (parent === directory ? undefined : packageNameOf(parent));
  packageNames.set(directory, name);

  return name;
}

/** A file Nitro must not drop for being imported for what it runs: it belongs to a `@fougere/*` package. */
export const isFougerePackage = (id: string): boolean =>
  isAbsolute(id) && (packageNameOf(dirname(id))?.startsWith('@fougere/') ?? false);
