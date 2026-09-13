import type { FieldName } from '../field/FieldName.js';
import type { Fields } from '../field/Fields.js';

// Ex: [['title', 'name'], ['id']]
export type CompositeUnique<TFields extends Fields> =
  readonly (readonly FieldName<TFields>[])[];
