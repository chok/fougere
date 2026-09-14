import { type DeclaredEdge, type Edge, type FrondPlacement } from '@fougere/core/contract';

/** One frond as the page draws it: its placement, and the calls observed around it. */
export interface TopologyNode extends FrondPlacement {
  /** Fronds this one called, with what it cost them. */
  calls: Edge[];
  /** Fronds that called this one. */
  calledBy: Edge[];
  /** Fronds its code reaches, whether or not a call has ever gone down the link. */
  declaredCalls: DeclaredEdge[];
  /** Where the config says to reach it, when it says so. */
  at?: string;
  /**
   * Declared in `remotes:` and never heard from. A different absence from an opaque remote,
   * which answered and keeps its shape to itself: this one may simply be down.
   */
  silent: boolean;
}
