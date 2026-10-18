import { dirname, isAbsolute, join, sep } from 'node:path';
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

/**
 * A module Nitro must not drop for being imported for what it runs: it belongs to a package the
 * config names — a file in one, or the package named, as an external is in a dev build.
 */
export const inPackages = (named: ReadonlySet<string>) => (id: string): boolean => {
  if (isAbsolute(id)) {
    const name = packageNameOf(dirname(id));

    return name !== undefined && named.has(name);
  }

  return [...named].some((name) => id === name || id.startsWith(`${name}/`));
};

/** A module under one of these directories — a frond's own files, `vocabulary/` imported for what it registers. */
export const inDirectories = (directories: readonly string[]) => (id: string): boolean =>
  directories.some((directory) => id.startsWith(directory + sep));
