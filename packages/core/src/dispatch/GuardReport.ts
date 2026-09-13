import { type Fields } from '@fougere/schema';

/** What a guard says about a filter it let through. The boot owns the voice. */
export interface GuardReport {
  /** The fields this facade hands back, when it hands back fewer than the entity has. */
  view?: Fields;
  /** Said once per field — a filter is not a write, and a warning per call is noise. */
  outOfView?: (message: string) => void;
}
