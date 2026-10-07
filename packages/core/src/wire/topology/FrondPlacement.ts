import type { Placement } from '../Placement.js';

/** A frond this process knows about, and whether it runs here. */
export interface FrondPlacement {
  frond: string;
  placement: Placement;
  entities: number;
  facades: number;
}
