import type { NameOf } from './NameOf.js';

/** What a config file can carry about a source — values, never a live driver. */
export interface SourceConfig {
  /** The adapter that realizes it. Absent means the conventional one. */
  source?: NameOf<'source'>;
  /** The entities whose rows live here. Absent on the default source: it holds the rest. */
  entities?: string[];
  [key: string]: unknown;
}
