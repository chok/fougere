/** One statement, as the panel shows it — never a parameter's value. */
export interface QueryLine {
  seq: number;
  storage: string;
  sql: string;
  parameters: number;
  ms: number;
  failed: boolean;
  at: number;
}
