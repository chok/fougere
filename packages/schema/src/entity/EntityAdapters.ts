import type { FieldName, Fields } from '../field/Field.js';

// eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/no-empty-object-type
export interface FougereEntityAdapters<K extends string> {}

export type EntityAdapters<TFields extends Fields> = Readonly<
  Partial<FougereEntityAdapters<FieldName<TFields>>>
>;
