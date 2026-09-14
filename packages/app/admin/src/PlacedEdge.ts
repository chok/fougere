import type { Point } from './Point.js';

/**
 * One link between two nodes. `count` is absent on a link nothing has travelled: the config
 * declares it and no call has gone down it, which is drawn broken rather than not drawn.
 */
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
