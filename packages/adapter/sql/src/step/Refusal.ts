/** Something the step asks and the DDL will not do, naming why and what fixes it. */
export interface Refusal {
  entity: string;
  field: string;
  reason: string;
}
