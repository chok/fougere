// ─── Axis 3 · lifecycle — WHO WRITES THE VALUE, AT WHICH MOMENT ────
// Indexed by the write moment; reading is a key access and a switch on a named token,
// never an interpreter. Declarative and named — never a closure, which would be a value
// mutation invisible to adapters. Coercion is the `boundary` axis, not this one.

/**
 * Generator TOKEN — a preset, or a name registered via {@link registerGenerator}. Never a
 * closure: a function vanishes through describe/reconstruct without an error, and the
 * remote frond pays. A name fails loudly and locally instead.
 */
export type GeneratorRef = 'cuid2' | 'uuid' | 'nanoid' | (string & {});

/** The moments a value can be written at — the runtime list, from which the types derive. */
export const CREATE_TOKENS = ['now', 'optional'] as const;
export const UPDATE_TOKENS = ['now', 'forbidden'] as const;

export interface Lifecycle {
  /**
   * What happens when the input omits the value. Absent → required. `{ value }` fills a
   * literal, `'now'` stamps, `{ generate }` has the storage stamp an id, `'optional'`
   * permits absence and produces nothing. A supplied value is always accepted.
   */
  create?: { value: unknown } | { generate: GeneratorRef } | (typeof CREATE_TOKENS)[number];
  /**
   * What happens on a patch. Absent → written only if supplied. `'now'` stamps at every
   * update (the canonical `updatedAt`). `'forbidden'` makes supplying it an error.
   * The judge only JUDGES; stamping is the storage's, at the point of persistence.
   */
  update?: (typeof UPDATE_TOKENS)[number];
}

// ─── Generator registry ──────────────────────────────────
// `registerGenerator('monId', fn)` → `primary({ generate: 'monId' })`. The built-in
// presets live with the realization (`projections/lifecycle.ts`), which consults this
// first — resolving them per adapter is what made two adapters honour `cuid2` differently.

const generators = new Map<string, () => string>();

export function registerGenerator(name: string, fn: () => string): void {
  generators.set(name, fn);
}

/** A registered custom generator, or undefined (built-in presets live storage-side). */
export function resolveCustomGenerator(ref: GeneratorRef): (() => string) | undefined {
  return generators.get(ref);
}
