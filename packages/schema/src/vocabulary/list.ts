import { Field } from '../field/index.js';

export interface ListOptions {
  /** Minimum number of elements. */
  min?: number;
  /** Maximum number of elements. */
  max?: number;
}

/**
 * A list of VALUES — `tags: list(text())`, `scores: list(number())`. The element's
 * shape travels as JSON Schema `items`, so the engine validates every element natively.
 *
 * NOT a relation: `many(Post)` is a role (related rows, no value shape); `list(text())`
 * is a value (an array column/JSON, fully owned by the record).
 *
 * Only the element's `shape` embeds. Its other axes are meaningless per-element and are
 * DROPPED SILENTLY — `list(primary())` is accepted and loses the role. The guard below
 * only rejects a relation. Tightening it to reject a carried lifecycle/boundary is open.
 */
export function list<T>(item: Field<T>, opts?: ListOptions): Field<T[]> {
  // Reads the ROLE, not the absence of a shape: since every field carries one, `many(Post)`
  // now has an array shape too, and embedding it would claim the other side's rows are ours.
  if (item.role?.relation) throw new Error('list() takes a value field (text(), number()…) — a relation has no value shape');
  return new Field<T[]>({
    shape: { type: 'array', items: item.shape, minItems: opts?.min, maxItems: opts?.max },
  });
}
