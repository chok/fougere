import type { DeclaredFrond } from './DeclaredFrond.js';
import type { DeclaredEdge } from './DeclaredEdge.js';

/**
 * What the config SAYS, beside what the runtime SAW. The two disagree exactly when something
 * is misconfigured, and a frond that never answered is absent from the observed half — so
 * without this one, nothing tells a silent dependency from an absent one.
 */
export interface DeclaredTopology {
  fronds: DeclaredFrond[];
  edges: DeclaredEdge[];
}
