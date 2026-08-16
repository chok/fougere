// ─── What an entity declares ABOUT ITSELF — the 2nd argument of `entity()` ────
// Two things, and they have nothing in common but the place they are written: uniqueness
// groups, which the database enforces, and per-adapter hints, which the framework ignores.
// Not abstracted into one notion for that reason — being written side by side is a fact of
// syntax, not an invariant.
//
// It is SYNTAX: `entity()` realizes the groups onto the fields and keeps no copy beside them.

import type { Fields } from './Field.js';

/**
 * Field names that identify at most one row when taken together. No shape can express it —
 * judging one value never sees the other rows — and no handler either: a check then a write
 * is two round trips with room for a concurrent one between them. Only the database keeps it.
 */
export type CompositeUnique<TFields extends Fields> = ReadonlyArray<
  ReadonlyArray<Extract<keyof TFields, string>>
>;

/**
 * What an entity declares about itself, beyond its fields — the 2nd argument of `entity()`.
 *
 * One object rather than a growing parameter list: a second fact about an entity adds a key
 * here, never a positional argument. It is SYNTAX: `entity()` realizes it onto the fields
 * and keeps no copy beside them.
 */
export interface EntityDeclarations<TFields extends Fields> {
  unique?: CompositeUnique<TFields>;
  /** Per-consumer hints, keyed by registered adapter. See {@link Hints}. */
  hints?: Hints<TFields>;
}

/**
 * Per-consumer hints — the escape hatch for what a neutral field cannot carry ("store
 * `body` as a `tsvector`"), which validation and the API ignore.
 *
 * EMPTY here: this package names no adapter. Each augments it from its own package, and
 * `K` — the entity's field-key union — constrains a hint's inner keys to real fields.
 *
 * ```ts
 * declare module '@fougere/schema' {
 *   interface FougereHints<K extends string> {
 *     sql?: Partial<Record<K, { columnType?: string; index?: string }>>;
 *   }
 * }
 * ```
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/no-empty-object-type
export interface FougereHints<K extends string> {}

/** Keyed by registered adapter — an unknown adapter, field or option is refused at the call site. */
export type Hints<TFields extends Fields> = {
  [A in keyof FougereHints<Extract<keyof TFields, string>>]?: FougereHints<
    Extract<keyof TFields, string>
  >[A];
};

/**
 * Carry hints across a key transform — a derivation preserves what it does not change.
 * `transform` maps an old key to its new name, or to `undefined` when the field is dropped.
 */
export function deriveHints(
  hints: Hints<Fields> | undefined,
  transform: (key: string) => string | undefined,
): Hints<Fields> | undefined {
  if (!hints) return undefined;
  const out: Record<string, Record<string, unknown>> = {};
  for (const [adapter, perField] of Object.entries(hints as Record<string, Record<string, unknown> | undefined>)) {
    if (!perField || typeof perField !== 'object') continue;
    const mapped: Record<string, unknown> = {};
    for (const [key, hint] of Object.entries(perField)) {
      const next = transform(key);
      if (next !== undefined) mapped[next] = hint;
    }
    if (Object.keys(mapped).length) out[adapter] = mapped;
  }
  return Object.keys(out).length ? (out as Hints<Fields>) : undefined;
}
