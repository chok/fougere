import { vocabulary } from './vocabulary.js';
import { Field } from '../Field.js';

/**
 * Reads filter on this field often — `index: true` on the role axis. It changes no answer,
 * only the cost of one, which is why it is the one word here that is a hint and not a rule.
 * `unique()` already implies an index on every engine, so declaring both is redundant.
 */
export const indexed: <T>(field: Field<T>) => Field<T> = vocabulary('indexed', () => ({ role: { index: true } }));
