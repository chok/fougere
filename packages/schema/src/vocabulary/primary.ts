import { Field } from '../Field.js';
import { registerGenerator, type GeneratorRef } from '../axis/Lifecycle.js';
import { Judge } from '../judge/Judge.js';

interface PrimaryOptions {
  /**
   * Generator token: a built-in preset, a name registered via
   * `registerGenerator`, or the colocated `[name, fn]` tuple — which registers
   * and names in one gesture (the Field only ever carries the name).
   */
  generate?: GeneratorRef | [name: string, fn: () => string];
}

/**
 * Create a primary key field.
 *
 * - `primary()` — auto-generated CUID2 string ID (default)
 * - `primary({ generate: 'uuid' })` — auto-generated UUID v4
 * - `primary({ generate: ['monId', fn] })` — custom generator, registered + named
 * - `primary(field)` — promote any field to primary key (no auto-generation:
 *   the value must be supplied, so no `create` rule is stated)
 */
export function primary(opts?: PrimaryOptions): Field<string>;
export function primary<T>(field: Field<T>): Field<T>;
export function primary(fieldOrOptions?: Field | PrimaryOptions): Field {
  // primary(field) — promote an existing field to primary key. `with` keeps every axis
  // (boundary, meta…); the role gains `primary`, and identity in the graph implies
  // immutability in time: `update: 'forbidden'` (decided 2026-07-15).
  // `isField` and not a brand: the two overloads are told apart by SHAPE, which a field
  // always states and `PrimaryOptions` (a lone `generate?`) never does.
  if (Judge.isField(fieldOrOptions)) {
    const field = fieldOrOptions;
    return field.with({
      role: { ...field.role, primary: true },
      lifecycle: { ...field.lifecycle, update: "forbidden" },
    });
  }

  // primary() or primary({ generate }) — auto-generated string ID
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
    // An id is immutable by default: re-supplying it in a patch is an error.
    lifecycle: { create: { generate }, update: "forbidden" },
  });
}
