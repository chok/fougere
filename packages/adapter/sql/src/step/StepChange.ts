/** What a step asks of the tables — beyond what an additive pass already covers. */
export type StepChange =
  | { kind: 'renameColumn'; table: string; from: string; to: string }
  | { kind: 'dropColumn'; table: string; column: string };
