import type { FieldName, Fields } from './fields/Field.js';
import { isObject } from './judge/ValueForm.js';

// eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/no-empty-object-type
export interface FougereEntityAdapters<K extends string> {}

export type EntityAdapters<TFields extends Fields> = Readonly<Partial<FougereEntityAdapters<FieldName<TFields>>>>;

/** What `cut` REQUIRES of an augmentation, and the open registry cannot state: addressed by field. */
type FieldEntries = Record<FieldName<Fields>, unknown>;

type AdapterEntries = Record<string, FieldEntries>;

/**
 * What one schema states per adapter: an adapter name, a field name, then that adapter's own value.
 */
export class EntityAdapterSet {
  private constructor(private readonly byAdapter: AdapterEntries) {}

  static of(declared: EntityAdapters<Fields> | undefined): EntityAdapterSet | undefined {
    if (declared === undefined) return undefined;

    if (!isObject(declared)) {
      throw new Error(
        `adapters: expected an object keyed by adapter name, got ${typeof declared}.`,
      );
    }

    const byAdapter: AdapterEntries = {};

    for (const [adapter, perField] of Object.entries(declared as AdapterEntries)) {
      if (perField === undefined) continue;

      if (!isObject(perField)) {
        throw new Error(
          `adapters.${adapter}: expected an object keyed by field name, got ${typeof perField}. ` +
            `What an adapter is handed is addressed by the field it applies to.`,
        );
      }

      if (Object.keys(perField).length) byAdapter[adapter] = perField;
    }

    return EntityAdapterSet.made(byAdapter);
  }

  /** Several schemas folded into one set; a later source wins, per adapter and per field. */
  static merged(sources: readonly (EntityAdapters<Fields> | undefined)[]): EntityAdapterSet | undefined {
    const out: AdapterEntries = {};

    for (const source of sources) {
      const set = EntityAdapterSet.of(source);
      if (!set) continue;

      for (const [adapter, perField] of Object.entries(set.byAdapter)) {
        out[adapter] = { ...out[adapter], ...perField };
      }
    }

    return EntityAdapterSet.made(out);
  }

  /** Every field name these entries address — what a caller checks against its own shape. */
  get fieldNames(): string[] {
    return [...new Set(Object.values(this.byAdapter).flatMap((perField) => Object.keys(perField)))];
  }

  /** The plain object, which is what a reader outside this package receives. */
  get stated(): EntityAdapters<Fields> {
    return this.byAdapter as EntityAdapters<Fields>;
  }

  /**
   * The entries whose field survives a cut, re-addressed by that field's new name.
   *
   * The adapter name is not a field and does not move; only the level below it does. An
   * entry left on the old name is not an error anywhere downstream — `adapter/sql` looks
   * it up by the field it is iterating and simply finds nothing.
   */
  cut(survives: (key: string) => string | undefined): EntityAdapterSet | undefined {
    const out: AdapterEntries = {};

    for (const [adapter, perField] of Object.entries(this.byAdapter)) {
      const mapped: FieldEntries = {};

      for (const [key, entry] of Object.entries(perField)) {
        const next = survives(key);
        if (next !== undefined) mapped[next] = entry;
      }

      if (Object.keys(mapped).length) out[adapter] = mapped;
    }

    return EntityAdapterSet.made(out);
  }

  private static made(byAdapter: AdapterEntries): EntityAdapterSet | undefined {
    return Object.keys(byAdapter).length ? new EntityAdapterSet(byAdapter) : undefined;
  }
}
