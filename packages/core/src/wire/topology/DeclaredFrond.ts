import type { Placement } from '../Placement.js';

/** A frond the config knows of, and where it says to reach it. */
export interface DeclaredFrond {
  frond: string;
  placement: Placement;
  /** The host and port `remotes:` names, absent when the frond runs here. */
  at?: string;
}
