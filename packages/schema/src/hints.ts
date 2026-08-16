import type { Fields } from './Field.js';

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
