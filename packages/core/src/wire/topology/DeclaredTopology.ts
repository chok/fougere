import type { DeclaredFrond } from './DeclaredFrond.js';
import type { DeclaredEdge } from './DeclaredEdge.js';

/** What the config says, beside what the runtime saw. */
export interface DeclaredTopology {
  fronds: DeclaredFrond[];
  edges: DeclaredEdge[];
}
