import { Field, type Described } from '../../field/Field.js';
import { created } from './created.js';
import { DESCRIBED, admits, judgeOptions } from '../../field/Word.js';

const ADMITS = admits('updated', {}, DESCRIBED);

export function updated(opts?: Described): Field<Date> {
  judgeOptions('updated', ADMITS, opts);

  const base = created(opts);

  return base.with({ lifecycle: { ...base.lifecycle, update: 'now' } });
}
