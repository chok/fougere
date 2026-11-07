import type { FieldName } from './FieldName.js';
import type { Fields } from './Fields.js';

/**
 * Field names in groups, order included.
 * Ex: `[['listId', 'docId'], ['slug']]`.
 */
export type FieldGroups<TFields extends Fields> = readonly (readonly FieldName<TFields>[])[];
