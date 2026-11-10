/** The process that holds rows this one names, reached by the two readings core always serves. */
export interface Peer {
  /** Which of these keys no row answers over there — the write's question, asked across. */
  missing(entity: string, keys: readonly unknown[]): Promise<readonly unknown[]>;
  /** Who names these rows over there, and what becomes of them — its own `dependentsOf`. */
  dependents(entity: string): Promise<unknown>;
  /** Release a row over there: its rows go first, then the row, on its side of the wire. */
  release(entity: string, key: unknown, visited: readonly string[]): Promise<void>;
  /** Refuse, as a release would over there, marking what it asked — answered with the marks it set. */
  refuses(entity: string, key: unknown, visited: readonly string[]): Promise<readonly string[]>;
  /** Take these marks out over there. */
  forget(marks: readonly string[]): Promise<void>;
}
