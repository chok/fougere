import type { FougereSources } from './FougereSources.js';
import type { NameOf } from './NameOf.js';

/** One entry of `sources:` — what its type admits, and the entities it holds. */
export type SourceConfig = FougereSources[keyof FougereSources] & {
  /** The entities whose rows live here. Absent on the default source: it holds the rest. */
  rows?: NameOf<'entity'>[];
  /** The entities held here as ONE value each — injected as that value, never as rows. */
  values?: NameOf<'entity'>[];
};
