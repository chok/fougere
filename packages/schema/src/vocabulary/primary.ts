import { Field } from '../Field.js';
import { registerGenerator, type GeneratorRef } from '../axis/lifecycle/Generators.js';
import { Judge } from '../judge/Judge.js';

interface PrimaryOptions {
  generate?: GeneratorRef | [name: string, fn: () => string];
}

export function primary(opts?: PrimaryOptions): Field<string>;
export function primary<T>(field: Field<T>): Field<T>;
export function primary(fieldOrOptions?: Field | PrimaryOptions): Field {
  if (Judge.isField(fieldOrOptions)) {
    const field = fieldOrOptions;
    return field.with({
      role: { ...field.role, primary: true },
      lifecycle: { ...field.lifecycle, update: "forbidden" },
    });
  }

  const opts = (fieldOrOptions ?? {}) as PrimaryOptions;
  let generate: GeneratorRef;
  if (Array.isArray(opts.generate)) {
    const [name, fn] = opts.generate;
    registerGenerator(name, fn);
    generate = name;
  } else {
    generate = opts.generate ?? "cuid2";
  }
  return new Field<string>({
    shape: { type: "string" },
    role: { primary: true },
    lifecycle: { create: { generate }, update: "forbidden" },
  });
}
