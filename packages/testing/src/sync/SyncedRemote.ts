import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { REMOTES } from '@fougere/core/node';

/** One directory of `remotes/`, written by `fougere sync`. */
export interface SyncedRemote {
  name: string;
  /** Where the synced classes were written. */
  path: string;
}

/** The remotes a project synced. No directory is the ordinary case: an app with no remote synced nothing. */
export async function syncedRemotes(root: string): Promise<SyncedRemote[]> {
  const remotes = join(root, REMOTES);
  const entries = await readdir(remotes, { withFileTypes: true }).catch(() => []);

  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => ({ name: entry.name, path: join(remotes, entry.name) }));
}
