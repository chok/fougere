import type { Fields } from "./field/index.js";

/**
 * Open registry of per-consumer hints — the escape hatch for the irreducible
 * bits a single neutral field can't carry (e.g. "store `body` as a `tsvector`
 * with a GIN index", which validation and the API must ignore).
 *
 * EMPTY here on purpose: `@fougere/schema` names no adapter and depends on none.
 * Each adapter augments this from its OWN package via declaration merging —
 *
 * ```ts
 * declare module '@fougere/schema' {
 *   interface FougereHints<K extends string> {
 *     sql?: Partial<Record<K, { columnType?: string; index?: string }>>;
 *   }
 * }
 * ```
 *
 * `K` is the entity's field-key union, so a hint's inner keys are constrained to
 * real fields. Until an adapter augments it the registry is `{}` — there is simply
 * nothing to hint against, and the constraint materialises once an adapter is in
 * the compilation. No dependency inversion: schema never names an adapter.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/no-empty-object-type
export interface FougereHints<K extends string> {}

/**
 * Per-consumer hints for an entity, keyed by registered adapter. Only adapters
 * present in {@link FougereHints} are accepted; unknown adapters, unknown fields
 * and unknown options are all rejected at the call site.
 */
export type Hints<TFields extends Fields> = {
  [A in keyof FougereHints<Extract<keyof TFields, string>>]?: FougereHints<
    Extract<keyof TFields, string>
  >[A];
};

/**
 * Carry hints across a field-key transform — the schema-level twin of `cloneField`'s
 * invariant: a derivation preserves everything it doesn't explicitly change. `transform`
 * maps an old key to its new name, or to `undefined` when the field is dropped; each
 * adapter's per-field hints follow their fields.
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
