/** What one refresh did — enough to log it, and to decide whether to run again. */
export interface Refreshed {
  /** Instances written, counting a replaced one once. */
  written: number;
  /** The age the pull was asked to start from — absent when it asked for everything. */
  since?: Date;
  /** How long the whole pass took, pull included. */
  ms: number;
}
