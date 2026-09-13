/** One statement this process ran, and what it cost. */
export interface QueryEvent {
  /** Which storage ran it — a process may open several (`sources:`). */
  storage: string;
  sql: string;
  /** What it read or wrote, or the storage when the statement names no table. */
  subject: string;
  /** `select`, `insert`, `update`, `delete` — its first word, whatever that turns out to be. */
  verb: string;
  /** How MANY parameters, never their values. */
  parameters: number;
  /** Rounded to three decimals: a sub-microsecond statement reports 17 digits otherwise. */
  ms: number;
  failed: boolean;
  at: number;
}
