/**
 * The thirteen gestures of {@link Storage}, derived from four.
 *
 * A place rows live varies in ONE thing — how a row is fetched, written, dropped and
 * enumerated. Everything above that is the same everywhere: what a page is, how a criterion
 * matches, which stamps survive an upsert, and the two refusals a `create` owes its caller.
 * Measured on the Map realization: 14 lines of 140 touched the store.
 *
 * So an adapter supplies {@link Rows} and receives a whole `StorageFactory`. It is the frame
 * a third party writing a source needs — without it, `Sources.register` hands over a
 * four-gesture contract and leaves the thirteen to be re-derived, which is how three
 * divergent copies of the same store ended up in this repo's own demos.
 *
 * What is NOT here: `transacted`. A unit of work belongs to the engine that has one, and
 * this frame has none — which is why a `Source` built on it leaves the key absent and a
 * frame compensates.
 */
import { applyCreate, applyUpdate, Lifecycle, Role, type SchemaView } from '@fougere/schema';
import type { Storage, StorageFactory } from './storage.js';

/** One row, as every realization hands it over. */
export type Row = Record<string, unknown>;

/**
 * A keyed collection of rows — what an adapter supplies, and all of it.
 *
 * Async on purpose, even where a realization is not: a Map answers instantly and a directory
 * does not, and the frame above cannot be written twice. `client` is what the port's own
 * escape hatch exposes, `unknown` for the reason it is there.
 */
export interface Rows {
  get(key: string): Promise<Row | undefined>;
  has(key: string): Promise<boolean>;
  set(key: string, row: Row): Promise<void>;
  delete(key: string): Promise<boolean>;
  /** Every row it holds. A realization that cannot answer this cheaply says so in its doc. */
  all(): Promise<Row[]>;
  /** Handed on as `Storage.client` — the Map, the directory, whatever it is. */
  readonly client: unknown;
}

export function storageOver(open: (entity: SchemaView, name: string) => Rows): StorageFactory {
  return (entity: SchemaView, name: string): Storage => {
    const fields = entity.getFields();
    const rows = open(entity, name);
    const pk = Object.entries(fields).find(([, field]) => Role.of(field).isPrimary)?.[0] ?? 'id';
    // `Storage.findById(id: string)` — but a key can hold a number, and a Map keyed on
    // `1` does not answer `'1'`. SQL never had the question; here the divergence was
    // silent and only on this storage.
    const keyOf = (value: unknown) => String(value);
    // Same contract as SQL: a criterion may name a SET, and an empty set matches nothing.
    const matches = (row: Record<string, unknown>, criteria: Record<string, unknown>) =>
      Object.entries(criteria).every(([key, value]) => Array.isArray(value)
        ? value.some((v) => Object.is(row[key], v))
        : Object.is(row[key], value));
    return {
      client: rows.client,
      async list(options?: any) {
        let items = await rows.all();
        if (options?.where) items = items.filter((row) => matches(row, options.where));
        // Held before the page is cut, and after the filter: `total` answers "how many
        // match", which is what a paginator divides. Reading `store.size` at the end
        // answered a different question — every row the store holds, including the ones
        // the filter exists to keep out of this caller's sight.
        const matching = items.length;
        const limit = options?.limit;
        const offset = options?.page && limit ? (options.page - 1) * limit : options?.offset ?? 0;
        if (offset > 0) items = items.slice(offset);
        const hasMore = limit ? items.length > limit : false;
        if (limit) items = items.slice(0, limit);
        const result = items as any;
        result.hasMore = hasMore;
        result.endCursor = items.length > 0 ? String((items[items.length - 1] as any)[pk] ?? '') : undefined;
        if (options?.count) result.total = matching;
        return result;
      },
      async findById(id: string) { return await rows.get(keyOf(id)); },
      async findBy(criteria: Record<string, unknown>) {
        return (await rows.all()).find((row) => matches(row, criteria));
      },
      async findAllBy(criteria: Record<string, unknown>) {
        return (await rows.all()).filter((row) => matches(row, criteria));
      },
      // Same contract as SQL: a map keyed by the primary key, a miss being an absent key.
      async findByKeys(ids: readonly string[]) {
        const found = new Map<string, Record<string, unknown>>();
        for (const id of ids) {
          const row = await rows.get(keyOf(id));
          if (row) found.set(String(id), row);
        }
        return found;
      },
      // The dual, same contract as SQL: grouped by the value read off the ROW.
      async findAllByKeys(field: string, keys: readonly string[]) {
        const grouped = new Map<string, Record<string, unknown>[]>();
        if (keys.length === 0) return grouped;
        const wanted = new Set(keys.map(String));
        for (const row of await rows.all()) {
          const key = String(row[field]);
          if (!wanted.has(key)) continue;
          const bucket = grouped.get(key);
          if (bucket) bucket.push(row); else grouped.set(key, [row]);
        }
        return grouped;
      },
      // Same contract as SQL: the key and the creation stamps survive an overwrite.
      async upsert(input: Partial<Record<string, unknown>>) {
        const record = applyCreate(fields, applyUpdate(fields, input));
        const id = record[pk] as string | undefined;
        if (id === undefined) throw new Error(`${name}.upsert(): no \`${pk}\` — an upsert needs the key it writes at.`);
        const previous = await rows.get(keyOf(id));
        if (previous) {
          for (const [key, field] of Object.entries(fields)) {
            if (key === pk || Lifecycle.of(field).stampedOnce) record[key] = previous[key];
          }
        }
        await rows.set(keyOf(id), record);
        return record;
      },
      async upsertAll(inputs: readonly Partial<Record<string, unknown>>[]) {
        for (const input of inputs) await this.upsert(input);
        return inputs.length;
      },
      async create(input: Partial<Record<string, unknown>>) {
        const record = applyCreate(fields, input);
        const id = record[pk] as string | undefined;
        // `primary(text())` declares no generator, so nothing fills the hole and the
        // caller has to. Keying on `undefined` would let the second create overwrite the
        // first, in silence — the old version hid this by inventing an `id` field the
        // entity never declared.
        if (id === undefined) {
          throw new Error(`${name}.create: '${pk}' is the primary key and nothing supplied it — this entity declares no generator for it.`);
        }
        // A create is not an upsert. `Map.set` overwrites, so a second create under the
        // same key answered "created" while destroying the previous row — SQL answers a
        // constraint violation, and a store that loses data silently is worse than one
        // that fails.
        if (await rows.has(keyOf(id))) {
          throw new Error(`${name}.create: '${pk}' ${JSON.stringify(id)} already exists.`);
        }
        await rows.set(keyOf(id), record);
        return record;
      },
      async update(id: string, input: Partial<Record<string, unknown>>) {
        const existing = await rows.get(keyOf(id));
        if (!existing) throw new Error(`Not found: ${id}`);
        const updated = { ...existing, ...applyUpdate(fields, input), [pk]: existing[pk] };
        await rows.set(keyOf(id), updated);
        return updated;
      },
      async delete(id: string) { return await rows.delete(keyOf(id)); },
      output(_schema: SchemaView) { return this; },
    };
  };
}
