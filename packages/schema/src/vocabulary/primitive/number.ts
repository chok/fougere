import { Field, type Shared } from '../../field/Field.js';

export interface NumberOptions extends Shared<number> {
  min?: number;
  max?: number;
  integer?: boolean;
}

export function number(opts?: NumberOptions): Field<number> {
  return new Field<number>({
    shape: {
      type: opts?.integer ? 'integer' : 'number',
      minimum: opts?.min,
      maximum: opts?.max,
    },
  }).setShared(opts);
}
