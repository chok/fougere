import type { FieldName } from '../field/FieldName.js';
import type { Fields } from '../field/Fields.js';
import type { FougereEntityAdapters } from './FougereEntityAdapters.js';

export type EntityAdapters<TFields extends Fields> = Readonly<
  Partial<FougereEntityAdapters<FieldName<TFields>>>
>;
