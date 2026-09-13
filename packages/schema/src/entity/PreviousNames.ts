import type { FieldName } from '../field/FieldName.js';
import type { Fields } from '../field/Fields.js';

export type PreviousNames<TFields extends Fields> = Readonly<
  Partial<Record<FieldName<TFields>, string>>
>;
