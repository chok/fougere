import type { RouteDefinition } from '@fougere/adapter-rest';

/** One row of the canonical table, in the form this facade matches against. */
export interface Matchable {
  /** `route.path` split once: a literal segment, or `:name` to capture. */
  segments: string[];
  route: RouteDefinition;
}
