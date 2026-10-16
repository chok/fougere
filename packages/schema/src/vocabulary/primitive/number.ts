import { Format } from '../../lib/Format.js';
import { word } from '../../field/Word.js';

/** `number({ integer: true, min: 1 })` → `{ type: 'integer', minimum: 1 }` */
export const number = word<number>()('number', { type: 'number' }, {
  min: ['minimum', Format.number],
  max: ['maximum', Format.number],
  integer: ['type', Format.flag, (integer: boolean) => (integer ? 'integer' : 'number')],
});

export type NumberOptions = NonNullable<Parameters<typeof number>[0]>;
