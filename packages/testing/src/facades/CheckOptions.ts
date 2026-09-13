import { type SampleOptions } from '../sample.js';

export interface CheckOptions extends SampleOptions {
  /** Values the generator cannot invent — the id of a row a `ref()` points at. */
  given?: Record<string, unknown>;
}
