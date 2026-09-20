import type { FieldName } from '../field/FieldName.js';
import type { Fields } from '../field/Fields.js';

/**
 * Field names grouped, as `unique` and `index` both are — `[['listId', 'docId'], ['slug']]`.
 * The ORDER inside a group counts for both: a unique constraint on `(a, b)` is not the one on
 * `(b, a)`, and an index on `(a, b)` serves a filter on `a` alone and never on `b` alone.
 */
export type FieldGroups<TFields extends Fields> = readonly (readonly FieldName<TFields>[])[];
