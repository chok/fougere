// ─── meta — the documentary compartment (NOT an axis) ────────────
// Universal, human-facing information. The contract is strict and holds: NO consumer
// ever DECIDES by reading meta — the axes govern behaviour, meta informs humans.
// Per-consumer specifics belong to `hints`, not here. Future candidates of the same
// nature: title, example, deprecated.

export interface Meta {
  /**
   * Human-readable annotation. Read by CLI help (`cli/bridge.ts`) and carried by the
   * portable card — that is the whole current reach. No OpenAPI generation exists in
   * this repo, and `schema-graphql` never reads meta.
   */
  description?: string;
}
