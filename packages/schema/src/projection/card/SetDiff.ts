import type { Diff } from './Diff.js';

export interface SetDiff {
  /** Entities the target bundle has and the source bundle had not. */
  entitiesAdded: string[];
  /** Entities the source bundle had and the target bundle has not. */
  entitiesRemoved: string[];
  /** Differences for entities present in both bundles; unchanged entities are absent. */
  entities: Record<string, Diff>;
}
