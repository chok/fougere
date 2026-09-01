import type { FieldName, Fields } from '../schema/fields/Field.js';
import type { EntityAdapters } from './EntityAdapters.js';

// Ex: [['title', 'name'], ['id']]
export type CompositeUnique<TFields extends Fields> =
  readonly (readonly FieldName<TFields>[])[];

export type PreviousNames<TFields extends Fields> = Readonly<
  Partial<Record<FieldName<TFields>, string>>
>;

export interface EntityDeclarations<TFields extends Fields> {
  adapters?: EntityAdapters<TFields>;
  previous?: PreviousNames<TFields>;
  unique?: CompositeUnique<TFields>;
}
