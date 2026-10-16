import type { Entity } from '../../entity/Entity.js';
import { ON_DELETE, Relation } from '../../axis/role/Relation.js';
import { Field, type Shared } from '../../field/Field.js';
import { Format } from '../../lib/Format.js';
import { admits, judgeOptions, type OptionsIn } from '../../field/Word.js';

const KEYS = { onDelete: Format.tokens(ON_DELETE) };
const ADMITS = admits('ref', KEYS);

export type RefOptions = OptionsIn<typeof KEYS> & Shared<string>;

export function ref<E extends Entity>(
  target: E | (() => E),
  opts?: RefOptions,
): Field<string> {
  judgeOptions('ref', ADMITS, opts);

  return new Field<string>({
    shape: { type: 'string' },
    role: { relation: Relation.one(target, opts?.onDelete) },
  }).setShared(opts);
}
