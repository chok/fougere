// ─── The generator registry — an open vocabulary, like Formats and Boundaries ────
// `registerGenerator('monId', fn)` → `primary({ generate: 'monId' })`. The built-in presets
// live with the realization (`applyLifecycle.ts`), which consults this FIRST — resolving
// them per adapter is what made two adapters honour `cuid2` differently.

/**
 * Generator TOKEN — a preset, or a name registered via {@link registerGenerator}. Never a
 * closure: a function vanishes through describe/reconstruct without an error, and the
 * remote frond pays. A name fails loudly and locally instead.
 */
export type GeneratorRef = 'cuid2' | 'uuid' | 'nanoid' | (string & {});

const generators = new Map<string, () => string>();

export function registerGenerator(name: string, fn: () => string): void {
  generators.set(name, fn);
}

/** A registered custom generator, or undefined (built-in presets live storage-side). */
export function resolveCustomGenerator(ref: GeneratorRef): (() => string) | undefined {
  return generators.get(ref);
}
