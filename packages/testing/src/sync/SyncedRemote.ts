import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

/** One entry of `.fougere/remotes.json`, written by `fougere sync`. */
export interface SyncedRemote {
  name: string;
  url: string;
  /** Where the synced classes were written. */
  path: string;
}

/** The remotes a project synced, read from the file `fougere sync` writes. */
export async function syncedRemotes(root: string): Promise<SyncedRemote[]> {
  try {
    const raw = await readFile(join(root, '.fougere', 'remotes.json'), 'utf8');
    const parsed = JSON.parse(raw) as Record<string, { url: string; path: string }>;
    return Object.entries(parsed).map(([name, one]) => ({ name, ...one }));
  } catch {
    // No file is the ordinary case: an app with no remote synced nothing.
    return [];
  }
}
