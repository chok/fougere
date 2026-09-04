import type { RouteKind } from './RouteAddress.js';

/** What crosses the door. */
export interface CallRecord {
  /** Monotonic, and the whole cursor protocol: a reader asks for what is above its own. */
  seq: number;
  frond?: string;
  entity: string;
  operation: string;
  surface?: string;
  /** Known at `resolved`, so absent on a call that never found a route. */
  route?: RouteKind;
  /** The traceparent the invocation carried, when one did. */
  trace?: string;
  /** The peer that established this call, when one did. */
  caller?: string;
  startedAt: number;
  /** Known at `settled`. */
  ms?: number;
  verdict: 'running' | 'ok' | 'failed';
  refusal?: { code?: string; message: string };
}

/** One page of the ring. */
export interface CallPage {
  calls: CallRecord[];
  cursor: number;
  inFlight: number;
  dropped: number;
}
