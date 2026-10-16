import type { FougereSources } from './FougereSources.js';
import type { NameOf } from './NameOf.js';

/** One entry of `sources:` — what its type admits, and the entities whose rows live there. */
export type SourceConfig = FougereSources[keyof FougereSources] & {
  /** Absent on the default source: it holds the rest. */
  entities?: NameOf<'entity'>[];
};
