import { Field, type Described } from '../../field/Field.js';
import { Generators, type GeneratorRef } from '../../axis/lifecycle/Generators.js';
import { Format } from '../../lib/Format.js';
import { DESCRIBED, admits, judgeOptions, type OptionsIn } from '../../field/Word.js';

const KEYS = { generate: Format.anything.as<GeneratorRef | [name: string, fn: () => string]>() };
const ADMITS = admits('primary', KEYS, DESCRIBED);

type PrimaryOptions = OptionsIn<typeof KEYS> & Described;

export function primary(opts?: PrimaryOptions): Field<string>;
export function primary<T>(field: Field<T>): Field<T>;
/**
 * The key: a generated id, or a declared field.
 * Ex: `primary()` is a `uuidv7`, `primary(number())` keys on a number.
 */
export function primary(fieldOrOptions?: Field | PrimaryOptions): Field {
  if (Field.is(fieldOrOptions)) {
    const field = fieldOrOptions;

    return field.with({
      role: { ...field.role, primary: true },
      lifecycle: { ...field.lifecycle, update: 'forbidden' },
    });
  }

  const opts: PrimaryOptions = fieldOrOptions ?? {};
  judgeOptions('primary', ADMITS, fieldOrOptions);

  let generate: GeneratorRef;
  if (Array.isArray(opts.generate)) {
    const [name, fn] = opts.generate;

    Generators.register(name, fn);

    generate = name;
  } else {
    generate = opts.generate ?? 'uuidv7';
  }

  return new Field<string>({
    shape: { type: 'string' },
    role: { primary: true },
    lifecycle: { create: { generate }, update: 'forbidden' },
  }).setShared(opts);
}
