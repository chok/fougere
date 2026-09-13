import type { CallRecord } from './CallRecord.js';

/** One page of the ring. */
export interface CallPage {
  calls: CallRecord[];
  cursor: number;
  inFlight: number;
  dropped: number;
}
