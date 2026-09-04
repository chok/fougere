import type { Fields } from '../schema/fields/Field.js';
import { isObject } from '../utils.js';
import type { EntityAdapters } from './EntityAdapters.js';

type AdapterConfiguration = Record<string, unknown>;
type AdapterConfigurations = Record<string, AdapterConfiguration>;

export class EntityAdapterSet {
  /**
   * `{ sql: { body: { columnType: { pg: 'tsvector' } } } }`
   */
  private constructor(readonly adapters: EntityAdapters<Fields>) {}

  /**
   * Stops a malformed declaration from propagating, by checking its two levels.
   * `of({ sql: { body: 3 } })` → passes; `of({ sql: 'oops' })` → throws, naming `adapters.sql`
   */
  static of(adapters?: EntityAdapters<Fields>): EntityAdapterSet {
    if (!adapters) return new EntityAdapterSet({});

    if (!isObject(adapters)) {
      throw new Error(
        `adapters: expected an object keyed by adapter name, got ${typeof adapters}.`,
      );
    }

    for (const [adapter, fields] of Object.entries(adapters)) {
      if (!isObject(fields)) {
        throw new Error(
          `adapters.${adapter}: expected an object keyed by field name, got ${typeof fields}. ` +
            `What an adapter is handed is addressed by the field it applies to.`,
        );
      }
    }

    return new EntityAdapterSet(adapters);
  }

  /**
   * Folds several into one, a later field entry replacing the earlier. Takes sets only, so
   * `of` stays the single way in and a caller says where a raw declaration enters.
   * `merged([of({ sql: { body: { columnType: { pg: 'text' } } } }), of({ sql: { body: {} } })])`
   * → `{ sql: { body: {} } }`
   */
  static merged(adapterSets: readonly EntityAdapterSet[]): EntityAdapterSet {
    const out: AdapterConfigurations = {};

    for (const adapterSet of adapterSets)
      for (const [adapter, configuration] of adapterSet.entries)
        out[adapter] = { ...out[adapter], ...configuration };

    return new EntityAdapterSet(out);
  }

  private get entries(): [string, AdapterConfiguration][] {
    return Object.entries(this.adapters);
  }

  /**
   * Collects every field addressed, so a declaration aimed at a missing field is caught.
   * `{ sql: { body: { columnType: { pg: 'tsvector' } } }, graphql: { body: {}, title: {} } }`
   * → `['body', 'title']`
   */
  get fieldNames(): string[] {
    return [
      ...new Set(this.entries.flatMap(([, configuration]) => Object.keys(configuration))),
    ];
  }

  /**
   * Follows a derivation — `pick`, `omit` and `rename` are one gesture: what remains, and
   * under what name. Called by `SchemaDefinition.derived`, and by nothing else.
   * `Post` states `adapters: { sql: { body: { columnType: { pg: 'tsvector' } } } }`
   * `Post.rename({ body: 'text' })` → `{ sql: { text: { columnType: { pg: 'tsvector' } } } }`
   * `Post.pick('id')`              → `{}` — `sql` had only `body` to say
   */
  mapFields(transform: (key: string) => string | undefined): EntityAdapterSet {
    const renamed: AdapterConfigurations = {};

    for (const [adapter, configuration] of this.entries) {
      const mapped: AdapterConfiguration = {};

      for (const [key, entry] of Object.entries(configuration)) {
        const newName = transform(key);

        if (newName !== undefined) mapped[newName] = entry;
      }

      // Drop an adapter left with no field. `Post.pick('id')` would otherwise answer
      // `{ sql: {} }` — a line the entity never wrote.
      if (Object.keys(mapped).length) renamed[adapter] = mapped;
    }

    return new EntityAdapterSet(renamed);
  }
}
