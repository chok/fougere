/** The thirteen gestures of {@link Storage}, derived from four. */
import { applyCreate, applyUpdate, Lifecycle, Role, type SchemaView } from '@fougere/schema';
import { comparisonOf, comparisonsIn, type Comparison } from './criterion.js';
import type { Storage, StorageFactory } from './port.js';

/** One instance, as every realization hands it over. */
export type Values = Record<string, unknown>;

/** Instances addressed by key — what an adapter supplies, and all of it. */
export interface Store {
  get(key: string): Promise<Values | undefined>;
  has(key: string): Promise<boolean>;
  set(key: string, values: Values): Promise<void>;
  delete(key: string): Promise<boolean>;
  /** Everything it holds. A realization that cannot answer this cheaply says so in its doc. */
  all(): Promise<Values[]>;
  /** Handed on as `Storage.client` — the Map, the directory, whatever it is. */
  readonly client: unknown;
}

export function storageOver(open: (entity: SchemaView, name: string) => Store): StorageFactory {
  return (entity: SchemaView, name: string): Storage => {
    const fields = entity.getFields();
    const store = open(entity, name);
    const pk = Object.entries(fields).find(([, field]) => Role.of(field).isPrimary)?.[0] ?? 'id';
    // `Storage.findById(id: string)` — but a key can hold a number, and a Map keyed on
    // `1` does not answer `'1'`. SQL never had the question; here the divergence was
    // silent and only on this storage.
    const keyOf = (value: unknown) => String(value);
    // Same contract as SQL: a criterion may name a SET, and an empty set matches nothing.
    // A comparison is told from a value by the FIELD, never by the criterion's own shape.
    const matches = (values: Record<string, unknown>, criteria: Record<string, unknown>) =>
      Object.entries(criteria).every(([key, value]) => {
        const comparison = comparisonOf(fields[key], value);
        if (comparison) return compares(values[key], comparison);

        return Array.isArray(value)
          ? value.some((v) => Object.is(values[key], v))
          : Object.is(values[key], value);
      });

    // A store holds whole instances and reads them whole, so the scope SQL puts in its
    // SELECT is applied here on the way out. Same set of gestures either way: everything
    // that hands back an instance, which leaves `delete` and `upsertAll` alone.
    const scoped = (selected?: Set<string>): Storage => {
      const pick = (values: Values): Values => (selected
        ? Object.fromEntries(Object.entries(values).filter(([key]) => selected.has(key)))
        : values);

      // Same contract as SQL: the key and the creation stamps survive an overwrite.
      // Named, and not reached through `this`: a caller may have wrapped these gestures,
      // and a derived one that goes back through the front door is judged twice.
      const upsert = async (input: Partial<Record<string, unknown>>): Promise<Values> => {
        const values = applyCreate(fields, applyUpdate(fields, input));
        const id = values[pk] as string | undefined;
        if (id === undefined) throw new Error(`${name}.upsert(): no \`${pk}\` — an upsert needs the key it writes at.`);
        const previous = await store.get(keyOf(id));
        if (previous) {
          for (const [key, field] of Object.entries(fields)) {
            if (key === pk || Lifecycle.of(field).stampedOnce) values[key] = previous[key];
          }
        }
        await store.set(keyOf(id), values);
        return pick(values);
      };

      return {
        client: store.client,
        async list(options?: any) {
          let items = await store.all();
          if (options?.where) items = items.filter((values) => matches(values, options.where));
          if (options?.orderBy) items = sorted(items, options.orderBy, options.order);
          // Held before the page is cut, and after the filter: `total` answers "how many
          // match", which is what a paginator divides. Reading `store.size` at the end
          // answered a different question — everything the store holds, including the ones
          // the filter exists to keep out of this caller's sight.
          const matching = items.length;
          const limit = options?.limit;
          const offset = options?.page && limit ? (options.page - 1) * limit : options?.offset ?? 0;
          if (offset > 0) items = items.slice(offset);
          const hasMore = limit ? items.length > limit : false;
          if (limit) items = items.slice(0, limit);
          // The cursor is read before the scope cuts: a view that drops the key still
          // pages, the way it does over SQL.
          const endCursor = items.length > 0 ? String((items[items.length - 1] as any)[pk] ?? '') : undefined;
          const result = items.map(pick) as any;
          result.hasMore = hasMore;
          result.endCursor = endCursor;
          if (options?.count) result.total = matching;
          return result;
        },
        async findById(id: string) {
          const values = await store.get(keyOf(id));
          return values && pick(values);
        },
        async findBy(criteria: Record<string, unknown>) {
          const values = (await store.all()).find((held) => matches(held, criteria));
          return values && pick(values);
        },
        async findAllBy(criteria: Record<string, unknown>) {
          return (await store.all()).filter((values) => matches(values, criteria)).map(pick);
        },
        // Same contract as SQL: a map keyed by the primary key, a miss being an absent key.
        async findByKeys(ids: readonly string[]) {
          const found = new Map<string, Record<string, unknown>>();
          for (const id of ids) {
            const values = await store.get(keyOf(id));
            if (values) found.set(String(id), pick(values));
          }
          return found;
        },
        // The dual, same contract as SQL: grouped by the value read off the instance.
        async findAllByKeys(field: string, keys: readonly string[]) {
          const grouped = new Map<string, Record<string, unknown>[]>();
          if (keys.length === 0) return grouped;
          const wanted = new Set(keys.map(String));
          for (const values of await store.all()) {
            const key = String(values[field]);
            if (!wanted.has(key)) continue;
            const bucket = grouped.get(key);
            if (bucket) bucket.push(pick(values)); else grouped.set(key, [pick(values)]);
          }
          return grouped;
        },
        upsert,
        async upsertAll(inputs: readonly Partial<Record<string, unknown>>[]) {
          for (const input of inputs) await upsert(input);
          return inputs.length;
        },
        async create(input: Partial<Record<string, unknown>>) {
          const values = applyCreate(fields, input);
          const id = values[pk] as string | undefined;
          // `primary(text())` declares no generator, so nothing fills the hole and the
          // caller has to. Keying on `undefined` would let the second create overwrite the
          // first, in silence — the old version hid this by inventing an `id` field the
          // entity never declared.
          if (id === undefined) {
            throw new Error(`${name}.create: '${pk}' is the primary key and nothing supplied it — this entity declares no generator for it.`);
          }
          // A create is not an upsert. `Map.set` overwrites, so a second create under the
          // same key answered "created" while destroying the previous instance — SQL answers a
          // constraint violation, and a store that loses data silently is worse than one
          // that fails.
          if (await store.has(keyOf(id))) {
            throw new Error(`${name}.create: '${pk}' ${JSON.stringify(id)} already exists.`);
          }
          await store.set(keyOf(id), values);
          return pick(values);
        },
        async update(id: string, input: Partial<Record<string, unknown>>) {
          const existing = await store.get(keyOf(id));
          if (!existing) throw new Error(`Not found: ${id}`);
          const updated = { ...existing, ...applyUpdate(fields, input), [pk]: existing[pk] };
          await store.set(keyOf(id), updated);
          return pick(updated);
        },
        async delete(id: string) { return await store.delete(keyOf(id)); },
        output(schema: SchemaView) { return scoped(new Set(Object.keys(schema.getFields()))); },
      };
    };

    return scoped();
  };
}

/**
 * The same comparisons SQL compiles, answered in memory. Every one a criterion names has
 * to hold — the rule two criteria already follow.
 */
function compares(held: unknown, comparison: Comparison): boolean {
  return comparisonsIn(comparison).every(([name, asked]) => {
    switch (name) {
      case 'gte': return ordered(held, asked, (a, b) => a >= b);
      case 'lte': return ordered(held, asked, (a, b) => a <= b);
      case 'gt': return ordered(held, asked, (a, b) => a > b);
      case 'lt': return ordered(held, asked, (a, b) => a < b);
      case 'ne': return !Object.is(held, asked);
      case 'contains': return String(held ?? '').includes(String(asked));
      case 'notIn': return !(asked as readonly unknown[]).some((one) => Object.is(held, one));
      case 'isNull': return (held === null || held === undefined) === Boolean(asked);
      case 'between': {
        const [low, high] = asked as [unknown, unknown];

        return ordered(held, low, (a, b) => a >= b) && ordered(held, high, (a, b) => a <= b);
      }
    }
  });
}

/** A row that holds nothing compares to nothing — the answer SQL gives for NULL. */
const ordered = (held: unknown, asked: unknown, holds: (a: number, b: number) => boolean): boolean =>
  held === null || held === undefined ? false : holds(order(held), order(asked));

/** What a Date and a number have in common, and a string keeps for itself. */
const order = (value: unknown): number =>
  value instanceof Date ? value.getTime() : (value as number);

/** The ORDER BY the engine would have compiled, answered over the rows the store held. */
const sorted = (rows: Values[], field: string, direction: 'asc' | 'desc' | undefined): Values[] =>
  [...rows].sort((left, right) =>
    (direction === 'desc' ? -1 : 1) * rank(left[field], right[field]));

/** A row that holds nothing sorts first, and two of them tie. */
const rank = (left: unknown, right: unknown): number => {
  if (left === null || left === undefined) return right === null || right === undefined ? 0 : -1;
  if (right === null || right === undefined) return 1;
  const [held, against] = [order(left), order(right)];

  return held === against ? 0 : held < against ? -1 : 1;
};
