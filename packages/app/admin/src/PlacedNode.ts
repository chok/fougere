import type { TopologyNode } from './TopologyNode.js';

/** A node placed on the drawing. `x`/`y` are its CENTRE, the convention the layout answers in. */
export interface PlacedNode {
  node: TopologyNode;
  x: number;
  y: number;
  width: number;
  height: number;
}
