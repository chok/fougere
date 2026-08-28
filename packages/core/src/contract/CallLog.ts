import type { DispatchEvent } from '../dispatch/DispatchEvent.js';

/**
 * What crosses the door: the address, the route it took, and the verdict.
 *
 * It lives here rather than beside its producer for the reason `TopologyReport` does: it
 * crosses a process boundary, so a reader that never installed `@fougere/calls` — the CLI
 * — needs its shape, and putting it there is what produces a hand-copied duplicate.
 *
 * Never the body. Same rule the topology report states — a remote destination is named,
 * not disclosed — and it holds here for the same reason: this answer leaves the process.
 */
export interface CallRecord {
  /** Monotonic, and the whole cursor protocol: a reader asks for what is above its own. */
  seq: number;
  frond?: string;
  entity: string;
  operation: string;
  surface?: string;
  /** Known at `resolved`, so absent on a call that never found a route. */
  route?: NonNullable<DispatchEvent['routeKind']>;
  startedAt: number;
  /** Known at `settled`. */
  ms?: number;
  verdict: 'running' | 'ok' | 'failed';
  refusal?: { code?: string; message: string };
}

/**
 * One page of the ring.
 *
 * `dropped` is what the ring could not keep — an absence is named rather than left to
 * look like a quiet period.
 */
export interface CallPage {
  calls: CallRecord[];
  cursor: number;
  inFlight: number;
  dropped: number;
}
