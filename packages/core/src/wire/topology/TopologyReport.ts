import type { FrondPlacement } from './FrondPlacement.js';
import type { Edge } from './Edge.js';
import type { DeclaredTopology } from './DeclaredTopology.js';

/** The shape of the system as ONE process discovered it — the answer to `rpc.topology`. */
export interface TopologyReport {
  /** When this process started counting — an edge count is read against it. */
  since: number;
  /** Calls running right now: the one signal a static shape cannot carry. */
  active: number;
  fronds: FrondPlacement[];
  edges: Edge[];
  declared: DeclaredTopology;
}
