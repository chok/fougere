/** One row of the canonical table, in the form this facade matches against. */
export interface Matchable {
  method: string;
  /** `route.path` split once: a literal segment, or `:name` to capture. */
  segments: string[];
  path: string;
  entityName: string;
  operationName: string;
}
