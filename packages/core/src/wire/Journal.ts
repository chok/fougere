import type { Call } from './Call.js';

/**
 * What writes a release down while it happens, so a sweep can finish what a stopped process began.
 *
 * Documented: [entities](https://fougere.dev/docs/concepts/entity).
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
