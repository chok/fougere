import type { Field } from './Field.js';
import type { Fields } from './Fields.js';

export type Values<TFields extends Fields> = {
  [K in keyof TFields]: TFields[K] extends Field<infer T> ? T : never;
};
