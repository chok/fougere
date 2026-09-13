import type { Fields } from './Fields.js';

export type FieldName<TFields extends Fields> = Extract<keyof TFields, string>;
