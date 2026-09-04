import { Field } from '../field/Field.js';
import { date } from './date.js';

/**
 * So a creation stamp is written by the storage and refused from a client.
 * FR : pour qu'un horodatage de création soit écrit par le storage et refusé au client.
 * `created()` → `create: 'now'`, `update: 'forbidden'`
 */
export function created(): Field<Date> {
  return date().with({
    lifecycle: { create: 'now', update: 'forbidden' },
  });
}
