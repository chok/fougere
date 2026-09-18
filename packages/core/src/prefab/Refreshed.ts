/** What one refresh did — enough to log it, and to decide whether to run again. */
export interface Refreshed {
  /** Instances written, counting a replaced one once. */
  written: number;
  /**
   * The age the pull was asked to start from, as an ISO string — absent when it asked for
   * everything. A STRING because a refresh is an operation: what it answers leaves through a
   * facade, where only data crosses, and a `Date` reaches a caller here and an ISO string
   * behind `fronds:` off the same code.
   */
  since?: string;
  /** How long the whole pass took, pull included. */
  ms: number;
}
