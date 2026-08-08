// ─── Axis 3 · lifecycle — WHO WRITES THE VALUE, AT WHICH MOMENT ────
// The normal form is indexed by the situation (the write moment); reading is a
// key access plus a switch on a named token — never an interpreter function.
// The interpretation happened ONCE, at declaration (the vocabulary translates
// its sugar into this form). Declarative, named only — never an opaque closure
// (a value mutation invisible to adapters is forbidden).
// (Coercion — converting a supplied value — is NOT here; that is the `boundary` axis.)

/**
 * Generator TOKEN — a built-in preset or a name registered via
 * {@link registerGenerator}. Never a closure: a function would silently vanish
 * through describe/reconstruct (JSON.stringify drops it without an error) and
 * the remote frond would pay. With a name, the failure is loud and local
 * ("unknown generator") instead of silent and at the neighbour's.
 */
export type GeneratorRef = 'cuid2' | 'uuid' | 'nanoid' | (string & {});

export interface Lifecycle {
  /**
   * The CREATE rule — what happens when the input omits the value:
   * - key absent      → required, the caller must supply it
   * - `{ value }`     → filled with this literal (a `default`)
   * - `'now'`         → stamped `new Date()` (a managed creation timestamp)
   * - `{ generate }`  → the storage adapter stamps a fresh id at insert
   * - `'optional'`    → absence permitted, nothing produced
   * A supplied value is always accepted (create); restricting WHAT a surface
   * accepts is a derivation (`pick`), never a rule here.
   */
  create?: { value: unknown } | 'now' | { generate: GeneratorRef } | 'optional';
  /**
   * The UPDATE rule — what happens on a patch:
   * - key absent     → the field is only written if the client supplies it
   * - `'now'`        → stamped `new Date()` at every update even when absent
   *                    (the canonical `updatedAt`); a supplied value is accepted
   * - `'forbidden'`  → immutable: supplying the field in a patch is a
   *                    validation error; absent, nothing happens
   * The validation only JUDGES these rules; realising `'now'` (stamping) is the
   * storage adapter's role at the point of persistence — same split as create.
   */
  update?: 'now' | 'forbidden';
}

// ─── Generator registry (open, same spirit as the boundary registries) ──
// CUSTOM generators, declared once per module:
//   registerGenerator('monId', () => …)  →  primary({ generate: 'monId' })
//
// The BUILT-IN presets (cuid2/uuid/nanoid) used to be resolved by each storage adapter,
// on the grounds that this package took no dependency. It took one already
// (`@cfworker/json-schema`, for the other projection), and the arrangement put the
// inversion in plain sight: a generator YOU invented reached every adapter, and the
// three the framework ships did not — so a second adapter honoured `cuid2` differently
// or not at all. They live with the realization now (`projections/lifecycle.ts`), which
// consults this registry first.

const generators = new Map<string, () => string>();

export function registerGenerator(name: string, fn: () => string): void {
  generators.set(name, fn);
}

/** A registered custom generator, or undefined (built-in presets live storage-side). */
export function resolveCustomGenerator(ref: GeneratorRef): (() => string) | undefined {
  return generators.get(ref);
}
