import { Field, type Shared } from '../../field/Field.js';

export function bool(opts?: Shared<boolean>): Field<boolean> {
  return new Field<boolean>({ shape: { type: 'boolean' } }).setShared(opts);
}
