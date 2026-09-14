import type { Call } from '../wire/Call.js';

/**
 * What writes a release down while it happens, when a package provides one.
 *
 * Core does the same hops in the same order either way — children before their parent, so an
 * interruption leaves fewer children and never an orphan. What a journal adds is that somebody
 * can finish what a stopped process started: the row says a release began, and a sweep redoes
 * it. Redoing is safe because every hop already is — a row taken out twice is taken out once.
 *
 * What writes a release down writes none of its own: the boot leaves out the entities of the
 * fronds an extension BROUGHT, so keeping the row that says a release began does not begin one.
 * Read from what was brought rather than written down, the way `CARRIES_LINE` is.
 *
 * Documented: [entities](https://fougere.dev/docs/schema/entities).
 */
export interface Journal {
  /** Hold this call until `runAt`, so a sweep dispatches it then and nobody waits for it now. */
  keep(call: Call, runAt: number): Promise<void>;
  /** Take this release on, or say another process is already driving it. */
  open(entity: string, key: string): Promise<'taken' | 'busy'>;
  close(entity: string, key: string): Promise<void>;
}

/** The container key a package registers its journal under. */
export const JOURNAL = 'Journal';
