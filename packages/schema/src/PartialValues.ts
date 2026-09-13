import type { Fields } from './field/Fields.js';
import type { Values } from './Values.js';

export type PartialValues<TFields extends Fields> = Partial<Values<TFields>>;
