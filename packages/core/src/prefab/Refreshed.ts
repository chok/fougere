/** What one refresh did — enough to log it, and to decide whether to run again. */
export interface Refreshed {
  /** Instances written, counting a replaced one once. */
  written: number;
  /** The age the pull started from, as an ISO string; absent when it asked for everything. */
  since?: string;
  /** How long the whole pass took, pull included. */
  ms: number;
}
