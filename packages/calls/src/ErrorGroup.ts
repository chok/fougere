/** One kind of refusal, and how often it happened. */
export interface ErrorGroup {
  seq: number;
  key: string;
  code: string;
  entity?: string;
  operation?: string;
  message: string;
  count: number;
  firstAt: number;
  lastAt: number;
  /** Which field was refused, for a VALIDATION_FAILED — the whole point of this source. */
  fields: { path: string; message: string }[];
  /** `dispatch` when a call carried it, `log` when it happened outside any call. */
  from: 'dispatch' | 'log';
}
