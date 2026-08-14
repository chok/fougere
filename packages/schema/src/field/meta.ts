// ─── meta — the documentary compartment (NOT an axis) ────────────
// Human-facing only. NO consumer ever DECIDES by reading meta — the axes govern
// behaviour. Per-consumer specifics belong to `hints`.

export interface Meta {
  /** Read by CLI help and carried by the card — that is the whole reach today. */
  description?: string;
}
