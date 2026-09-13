import type { Field } from './field/Field.js';
import type { Fields } from './field/Fields.js';

export type Values<TFields extends Fields> = {
  [K in keyof TFields]: TFields[K] extends Field<infer T> ? T : never;
};
