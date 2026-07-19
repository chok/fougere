// ─── meta — the documentary compartment (NOT an axis) ────────────
// Universal, human-facing information. The contract is strict: NO consumer ever
// DECIDES by reading meta — the axes govern behaviour, meta informs humans
// (CLI help, OpenAPI/GraphQL descriptions). Per-consumer specifics belong to
// `hints`, not here. Future candidates of the same nature: title, example,
// deprecated.

export interface Meta {
  /** Human-readable annotation — surfaces in CLI help, OpenAPI, GraphQL descriptions. */
  description?: string;
}
