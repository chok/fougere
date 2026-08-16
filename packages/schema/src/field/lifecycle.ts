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

export interface LifecycleRules {
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

/**
 * A field's lifecycle, resolved — the rules it declares, plus the questions its readers kept
 * asking by hand. Measured before writing: `create === undefined` was re-derived in four
 * packages, and `create === 'now' && update !== 'now'` was written twice, in two.
 *
 * Producing the value is NOT here — that is the storage's, at the point of persistence
 * (`projections/lifecycle.ts`). This says what the rule IS, not when it fires.
 *
 * ```ts
 * Lifecycle.of(text()).requiredAtCreate       // → true
 * Lifecycle.of(created()).stampedOnce         // → true
 * Lifecycle.of(primary()).immutable           // → true
 * Lifecycle.of(text({ default: 'x' })).literal  // → { value: 'x' }
 * ```
 */
export class Lifecycle implements LifecycleRules {
  readonly create?: LifecycleRules['create'];
  readonly update?: LifecycleRules['update'];

  private constructor(rules: LifecycleRules = {}) {
    this.create = rules.create;
    this.update = rules.update;
  }

  static of(field: { lifecycle?: LifecycleRules }): Lifecycle {
    return new Lifecycle(field.lifecycle);
  }

  /** The caller MUST supply it — no rule fills the hole, so absence is an error. */
  get requiredAtCreate(): boolean {
    return this.create === undefined;
  }

  /** Stamped at creation and never again — `created()`, as opposed to `updated()`. */
  get stampedOnce(): boolean {
    return this.create === 'now' && this.update !== 'now';
  }

  /** Supplying it in a patch is an error — an id, a `createdAt`. */
  get immutable(): boolean {
    return this.update === 'forbidden';
  }

  /** Re-stamped at every write. */
  get stampedOnUpdate(): boolean {
    return this.update === 'now';
  }

  /** The literal the field is born with, when it declares one. */
  get literal(): { value: unknown } | undefined {
    const rule = this.create;
    return typeof rule === 'object' && rule !== null && 'value' in rule
      ? { value: (rule as { value: unknown }).value }
      : undefined;
  }

  /** The generator TOKEN the storage must call, when the field names one. */
  get generator(): GeneratorRef | undefined {
    const rule = this.create;
    return typeof rule === 'object' && rule !== null && 'generate' in rule
      ? (rule as { generate: GeneratorRef }).generate
      : undefined;
  }
}

const generators = new Map<string, () => string>();

export function registerGenerator(name: string, fn: () => string): void {
  generators.set(name, fn);
}

/** A registered custom generator, or undefined (built-in presets live storage-side). */
export function resolveCustomGenerator(ref: GeneratorRef): (() => string) | undefined {
  return generators.get(ref);
}
