import type { Bucketed } from './Bucketed.js';
import { type Edge, type FrondPlacement } from '@fougere/core';

export interface MetricsSnapshot {
  /** When this process started counting — cumulative metrics are read against it. */
  since: number;
  series: Bucketed[];
  active: number;
  bounds: number[];
  /** The shape of the system as this process discovered it — declared nowhere. */
  topology: FrondPlacement[];
  /** Who calls whom, as observed here. Bounded by fronds², so it is a safe dimension. */
  edges: Edge[];
}
