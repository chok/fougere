export interface Bucketed {
  frond: string | undefined;
  entity: string;
  operation: string;
  error: string | undefined;
  count: number;
  sum: number;
  /** One more than the bounds: the last holds everything above the highest bound. */
  buckets: number[];
  /** The same measurement over `selfMs` — what the op did rather than what it waited for. */
  selfSum: number;
  selfBuckets: number[];
  /** Every statement these calls ran. Against `count`, it is statements per call. */
  statements: number;
}
