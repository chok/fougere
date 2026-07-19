import { createField, type Field } from '../field/index.js';

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
 * is a value (an array column/JSON, fully owned by the record). The element field's
 * value axis is what embeds — its `role`/`lifecycle`/`boundary` are meaningless
 * per-element and rejected by construction (only value fields make list elements).
 */
export function list<T>(item: Field<T, boolean>, opts?: ListOptions): Field<T[]> {
  if (!item.shape) throw new Error('list() takes a value field (text(), number()…) — a relation has no value shape');
  return createField<T[]>({
    shape: { type: 'array', items: item.shape, minItems: opts?.min, maxItems: opts?.max },
  });
}
