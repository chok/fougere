import type { FieldName, Fields } from './fields/Field.js';
import { isObject } from './judge/ValueForm.js';

// eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/no-empty-object-type
export interface FougereHints<K extends string> {}

export type Hints<TFields extends Fields> = Partial<FougereHints<FieldName<TFields>>>;

/** What `cut` REQUIRES of an augmentation, and the open registry cannot state: addressed by field. */
type ByField = Record<string, Record<FieldName<Fields>, unknown>>;

/**
 * The hints of one schema: an adapter name, a field name, then the adapter's own value.
 */
export class HintSet {
  private constructor(private readonly byAdapter: ByField) {}

  static of(declared: Hints<Fields> | undefined): HintSet | undefined {
    if (declared === undefined) return undefined;

    if (!isObject(declared)) {
      throw new Error(
        `hints: expected an object keyed by adapter name, got ${typeof declared}.`,
      );
    }

    const byAdapter: ByField = {};

    for (const [adapter, perField] of Object.entries(declared as ByField)) {
      if (perField === undefined) continue;

      if (!isObject(perField)) {
        throw new Error(
          `hints.${adapter}: expected an object keyed by field name, got ${typeof perField}. ` +
            `A hint is addressed by the field it applies to.`,
        );
      }

      if (Object.keys(perField).length) byAdapter[adapter] = perField;
    }

    return HintSet.made(byAdapter);
  }

  /** Several schemas folded into one set; a later source wins, per adapter and per field. */
  static merged(sources: readonly (Hints<Fields> | undefined)[]): HintSet | undefined {
    const out: ByField = {};

    for (const source of sources) {
      const set = HintSet.of(source);
      if (!set) continue;

      for (const [adapter, perField] of Object.entries(set.byAdapter)) {
        out[adapter] = { ...out[adapter], ...perField };
      }
    }

    return HintSet.made(out);
  }

  /** The plain object, which is what a reader outside this package receives. */
  get stated(): Hints<Fields> {
    return this.byAdapter as Hints<Fields>;
  }

  /**
   * The hints whose field survives a cut, re-addressed by that field's new name.
   *
   * The adapter name is not a field and does not move; only the level below it does. A
   * hint left on the old name is not an error anywhere downstream — `adapter/sql` looks
   * it up by the field it is iterating and simply finds nothing.
   */
  cut(survives: (key: string) => string | undefined): HintSet | undefined {
    const out: ByField = {};

    for (const [adapter, perField] of Object.entries(this.byAdapter)) {
      const mapped: Record<string, unknown> = {};

      for (const [key, hint] of Object.entries(perField)) {
        const next = survives(key);
        if (next !== undefined) mapped[next] = hint;
      }

      if (Object.keys(mapped).length) out[adapter] = mapped;
    }

    return HintSet.made(out);
  }

  private static made(byAdapter: ByField): HintSet | undefined {
    return Object.keys(byAdapter).length ? new HintSet(byAdapter) : undefined;
  }
}
