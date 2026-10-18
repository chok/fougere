import { readdir, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { DEFAULT_CONVENTIONS, frondPackage, type Conventions } from './Conventions.js';

/** The frond's name — the directory, unless its `package.json` renames it. */
export async function frondNameOf(frondPath: string, dirName: string): Promise<string> {
  try {
    const pkg = JSON.parse(await readFile(join(frondPath, 'package.json'), 'utf8')) as {
      fougere?: { frond?: unknown };
    };
    const declared = pkg.fougere?.frond;

    return typeof declared === 'string' && declared.length > 0 ? declared : dirName;
  } catch {
    return dirName;
  }
}

/** `@fronds/<name>` → the directory it names, for every frond of a project. */
export async function frondAliases(root: string, conventions: Conventions = DEFAULT_CONVENTIONS): Promise<Record<string, string>> {
  const frondsDir = join(root, conventions.fronds);
  const aliases: Record<string, string> = {};
  const dirs = await readdir(frondsDir, { withFileTypes: true }).catch(() => []);

  for (const dir of dirs.filter((entry) => entry.isDirectory()).map((entry) => entry.name)) {
    const path = join(frondsDir, dir);
    aliases[frondPackage(await frondNameOf(path, dir), conventions)] = resolve(path);
  }

  /** A SYNCED frond answers to the same name. */
  try {
    const registry = JSON.parse(
      await readFile(join(root, '.fougere', 'remotes.json'), 'utf8'),
    ) as Record<string, { path?: string }>;
    for (const [name, entry] of Object.entries(registry)) {
      if (typeof entry?.path !== 'string' || aliases[frondPackage(name, conventions)]) continue;
      aliases[frondPackage(name, conventions)] = resolve(entry.path);
    }
  } catch {
    // No registry, or an unreadable one: nothing was synced here. Not this function's
    // complaint — `sync` owns that file and reports on it.
  }

  return aliases;
}
