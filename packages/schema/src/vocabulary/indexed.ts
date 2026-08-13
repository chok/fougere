import { Field } from '../field/index.js';

/**
 * Reads filter on this field often — `index: true` on the role axis.
 *
 * Named `indexed` rather than `index`: `index` is taken everywhere in JavaScript (an
 * array position, a module's entry point), and a vocabulary word has to read as what it
 * says at the call site — `indexed(text())` states a property of the field, `index(...)`
 * would read as an action on it.
 *
 * It changes no answer, only the cost of getting one — which is why it is the one word
 * here that is a hint rather than a rule. The DDL emits `CREATE INDEX`; nothing else
 * reads it, and nothing should: a query that only works with the index is a query with
 * a bug.
 *
 * `unique()` already implies one — a uniqueness constraint is backed by an index on
 * every engine — so declaring both is redundant, not additive.
 */
export function indexed<T>(field: Field<T>): Field<T> {
  return field.with({ role: { ...field.role, index: true } });
}
