import { existsSync } from 'node:fs';
import { dirname, join, sep } from 'node:path';
import { DEFAULT_CONVENTIONS, loadConfig, resolveConventions } from '@fougere/core/node';

/** What a test file's position states about its subject. */
export interface Scope {
  /** The project the app boots from — where `fronds/` and `fougere.config.ts` live. */
  root: string;
  /** The frond under test. Absent means every frond is real: several of them, together. */
  frond?: string;
}

/** The frond a path sits in, or nothing. */
export function frondOf(path: string, frondsDir: string = DEFAULT_CONVENTIONS.fronds): string | undefined {
  const parts = path.split(sep);
  const at = parts.lastIndexOf(frondsDir);
  if (at === -1 || at + 1 >= parts.length) return undefined;
  const name = parts[at + 1];
  return name && !name.endsWith('.ts') ? name : undefined;
}

/** Where the project starts: */
export function rootOf(path: string): string | undefined {
  let at = dirname(path);
  let previous = '';
  while (at !== previous) {
    if (existsSync(join(at, 'fougere.config.ts')) || existsSync(join(at, DEFAULT_CONVENTIONS.fronds))) return at;
    previous = at;
    at = dirname(at);
  }
  return undefined;
}

/** The scope a test file declares by where it sits. */
export async function scopeOf(path: string): Promise<Scope | undefined> {
  const root = rootOf(path);
  if (!root) return undefined;
  // The root is known, so its config can say what the fronds directory is called before
  // the position is read against it.
  const { fronds } = resolveConventions((await loadConfig(root)).conventions);
  const frond = frondOf(path, fronds);
  return { root, ...(frond ? { frond } : {}) };
}

/** The path of the running test file, from vitest. */
export async function scopeOfRun(testPath: string | undefined): Promise<Scope | undefined> {
  return testPath ? scopeOf(testPath) : undefined;
}
