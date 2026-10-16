import { Field, type Described } from '../../field/Field.js';
import { date } from '../primitive/date.js';
import { DESCRIBED, admits, judgeOptions } from '../../field/Word.js';

const ADMITS = admits('created', {}, DESCRIBED);

export function created(opts?: Described): Field<Date> {
  judgeOptions('created', ADMITS, opts);

  return date(opts).with({
    lifecycle: { create: 'now', update: 'forbidden' },
  });
}
