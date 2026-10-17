/** The process that holds rows this one names, reached by the two readings core always serves. */
export interface Peer {
  /** Which of these keys no row answers over there — the write's question, asked across. */
  missing(entity: string, keys: readonly unknown[]): Promise<readonly unknown[]>;
  /** Who names these rows over there, and what becomes of them — its own `dependentsOf`. */
  dependents(entity: string): Promise<unknown>;
  /**
   * Release a row over there: its rows go first, then the row, on its side of the wire.
   *
   * `visited` travels so a release cannot bounce: two processes that declare each other would
   * otherwise ask each other about the same row forever. It is carried rather than held,
   * because the two sides share no memory.
   */
  release(entity: string, key: unknown, visited: readonly string[]): Promise<void>;
}
