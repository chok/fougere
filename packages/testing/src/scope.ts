import { existsSync } from 'node:fs';
import { dirname, join, sep } from 'node:path';

/**
 * What a test file's position states about its subject.
 *
 * The same reading the scan already performs on `entities/` and `handlers/`: a directory
 * is a declaration. A file under `fronds/blog/tests/` says its subject is `blog`, so that
 * frond is real and its neighbours are not — which is a TOPOLOGY, the very thing
 * `remotes:` states in production, and not a mode of testing.
 *
 * The sub-directory below `tests/` carries nothing. A name like `it('refuses a payment')`
 * is prose, and prose deciding how an app is wired is the hidden runtime the doctrine
 * refuses; a path is a position, which a reader sees by looking at where the file sits.
 */
export interface Scope {
  /** The project the app boots from — where `fronds/` and `fougere.config.ts` live. */
  root: string;
  /** The frond under test. Absent means every frond is real: several of them, together. */
  frond?: string;
}

/**
 * The frond a path sits in, or nothing.
 *
 * The LAST `fronds/` segment wins: a frond may hold a synced copy of a neighbour under
 * `.fougere/remotes/`, and a test that ever lands beside one is about the inner frond.
 */
export function frondOf(path: string): string | undefined {
  const parts = path.split(sep);
  const at = parts.lastIndexOf('fronds');
  if (at === -1 || at + 1 >= parts.length) return undefined;
  const name = parts[at + 1];
  return name && !name.endsWith('.ts') ? name : undefined;
}

/** Where the project starts: the first ancestor holding a config or a `fronds/`. */
export function rootOf(path: string): string | undefined {
  let at = dirname(path);
  let previous = '';
  while (at !== previous) {
    if (existsSync(join(at, 'fougere.config.ts')) || existsSync(join(at, 'fronds'))) return at;
    previous = at;
    at = dirname(at);
  }
  return undefined;
}

/**
 * The scope a test file declares by where it sits.
 *
 * Returns nothing when the file sits outside any project — a caller then states `root`
 * itself, which is what this package's own tests do against their fixtures.
 */
export function scopeOf(path: string): Scope | undefined {
  const root = rootOf(path);
  if (!root) return undefined;
  return { root, ...(frondOf(path) ? { frond: frondOf(path) } : {}) };
}

/**
 * The path of the running test file, from vitest.
 *
 * Read rather than guessed: `expect.getState()` is vitest's own API. Handed in by the
 * caller because this module is ESM and cannot `require`, and because a package that
 * imports vitest at the top level stops being loadable outside a test run.
 */
export function scopeOfRun(testPath: string | undefined): Scope | undefined {
  return testPath ? scopeOf(testPath) : undefined;
}
