import type { Point } from './Point.js';

/** One link between two nodes; `count` is absent when no call travelled it. */
export interface PlacedEdge {
  from: string;
  to: string;
  path: string;
  /** Where this link's figure goes — clear of every node, or absent when the route is a point. */
  at?: Point;
  count?: number;
  errors: number;
  /** Where this link's volume sits among the others, `0` to `1`. Absent when nothing travelled. */
  weight?: number;
}
