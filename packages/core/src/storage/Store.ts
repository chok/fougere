import { applyCreate, applyUpdate, Role, type SchemaView } from '@fougere/schema';
import { comparisonOf, comparisonsIn, type Comparison } from './Comparison.js';
import type { Storage } from './Storage.js';
import { isChange, type Change } from './Change.js';
import { Turns } from './Turns.js';
import { ErrorCode } from '../wire/ErrorCode.js';
import { FougereError } from '../wire/FougereError.js';
import type { StorageFactory } from './StorageFactory.js';
import type { Values } from './Values.js';
import type { ListResult } from './ListResult.js';

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
    const turns = Turns.of(store);
    const pk = Object.entries(fields).find(([, field]) => Role.of(field).isPrimary())?.[0] ?? 'id';
    const keyOf = (value: unknown) => String(value);
    const matches = (values: Record<string, unknown>, criteria: Record<string, unknown>) =>
      Object.entries(criteria).every(([key, value]) => {
        const comparison = comparisonOf(fields[key], value);
        if (comparison) return compares(values[key], comparison);

        return Array.isArray(value)
          ? value.some((v) => Object.is(values[key], v))
          : Object.is(values[key], value);
      });

    const own = new Set(Object.keys(fields));
    const scoped = (selected?: Set<string>): Storage => {
      const shown = selected ?? own;
      const pick = (values: Values): Values => Object.fromEntries(Object.entries(values).filter(([key]) => shown.has(key)));

      const upsert = async (input: Partial<Record<string, unknown>>): Promise<Values> => {
        const created = applyCreate(fields, applyUpdate(fields, input));
        const id = created[pk] as string | undefined;
        if (id === undefined) throw new Error(`${name}.upsert() needs a ${pk}.`);
        const previous = await store.get(keyOf(id));
        const values = previous ? { ...previous, ...applyUpdate(fields, input) } : created;
        await store.set(keyOf(id), values);

        return pick(values);
      };

      const prepared = async (input: Partial<Record<string, unknown>>): Promise<[string, Values]> => {
        const values = applyCreate(fields, input);
        const id = values[pk] as string | undefined;
        if (id === undefined) {
          throw new Error(`${name}.create() needs a ${pk}: nothing generates it. Pass one.`);
        }
        if (await store.has(keyOf(id))) {
          throw new FougereError({ code: ErrorCode.CONFLICT, message: `${name}.create: '${pk}' ${JSON.stringify(id)} already exists.` });
        }

        return [keyOf(id), values];
      };

      return {
        client: store.client,
        async list(options?: any) {
          let items = await store.all();
          if (options?.where) items = items.filter((values) => matches(values, options.where));
          if (options?.orderBy) items = sorted(items, options.orderBy, options.order);

          return paged(items, options, pk, pick);
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
        async findByKeys(ids: readonly string[]) {
          const found = new Map<string, Record<string, unknown>>();
          for (const id of ids) {
            const values = await store.get(keyOf(id));
            if (values) found.set(String(id), pick(values));
          }

          return found;
        },
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
          const [key, values] = await prepared(input);
          await store.set(key, values);

          return pick(values);
        },
        async createAll(inputs: readonly Values[]) {
          const rows = await Promise.all(inputs.map(prepared));
          const keys = rows.map(([key]) => key);
          const repeated = keys.find((key, index) => keys.indexOf(key) !== index);
          if (repeated !== undefined) {
            throw new FougereError({ code: ErrorCode.CONFLICT, message: `${name}.createAll: '${pk}' ${JSON.stringify(repeated)} is given twice.` });
          }
          for (const [key, values] of rows) await store.set(key, values);

          return rows.map(([, values]) => pick(values));
        },
        async update(id: string, input: Values | Change<Values>) {
          return turns.take(keyOf(id), async () => {
            const existing = await store.get(keyOf(id));
            if (!existing) throw new FougereError({ code: ErrorCode.NOT_FOUND, message: `No row in ${name} for ${JSON.stringify(id)}.` });
            const patch = isChange(input) ? await input(pick(existing)) : input;
            const updated = { ...existing, ...applyUpdate(fields, patch), [pk]: existing[pk] };
            await store.set(keyOf(id), updated);

            return pick(updated);
          });
        },
        async updateByKeys(ids: readonly string[], change: Change<Values>) {
          const keys = [...new Set(ids.map(keyOf))].sort();

          return turns.takeAll(keys, async () => {
            const held = await Promise.all(keys.map(async (key) => [key, await store.get(key)] as const));
            const absent = held.find(([, values]) => !values);
            if (absent) throw new FougereError({ code: ErrorCode.NOT_FOUND, message: `No row in ${name} for ${JSON.stringify(absent[0])}.` });

            const updated = new Map<string, Values>();
            for (const [key, existing] of held) {
              const patch = await change(pick(existing!));
              const values = { ...existing!, ...applyUpdate(fields, patch), [pk]: existing![pk] };
              await store.set(key, values);
              updated.set(key, pick(values));
            }

            return updated;
          });
        },
        async delete(id: string) { return await store.delete(keyOf(id)); },
        output(schema: SchemaView) { return scoped(new Set(Object.keys(schema.getFields()))); },
      };
    };

    return scoped();
  };
}

function compares(stored: unknown, comparison: Comparison): boolean {
  return comparisonsIn(comparison).every(([name, asked]) => {
    switch (name) {
      case 'gte': return ordered(stored, asked, (a, b) => a >= b);
      case 'lte': return ordered(stored, asked, (a, b) => a <= b);
      case 'gt': return ordered(stored, asked, (a, b) => a > b);
      case 'lt': return ordered(stored, asked, (a, b) => a < b);
      case 'ne': return !Object.is(stored, asked);
      case 'contains': return String(stored ?? '').includes(String(asked));
      case 'notIn': return !(asked as readonly unknown[]).some((one) => Object.is(stored, one));
      case 'isNull': return (stored === null || stored === undefined) === Boolean(asked);
      case 'between': {
        const [low, high] = asked as [unknown, unknown];

        return ordered(stored, low, (a, b) => a >= b) && ordered(stored, high, (a, b) => a <= b);
      }
    }
  });
}

const ordered = (stored: unknown, asked: unknown, holds: (a: number, b: number) => boolean): boolean =>
  stored === null || stored === undefined ? false : holds(order(stored), order(asked));

const order = (value: unknown): number =>
  value instanceof Date ? value.getTime() : (value as number);

const sorted = (rows: Values[], field: string, direction: 'asc' | 'desc' | undefined): Values[] =>
  [...rows].sort((left, right) =>
    (direction === 'desc' ? -1 : 1) * rank(left[field], right[field]));

const rank = (left: unknown, right: unknown): number => {
  if (left === null || left === undefined) return right === null || right === undefined ? 0 : -1;
  if (right === null || right === undefined) return 1;
  const [held, against] = [order(left), order(right)];

  return held === against ? 0 : held < against ? -1 : 1;
};

function paged(
  matched: Values[],
  options: { limit?: number; page?: number; offset?: number; count?: boolean } | undefined,
  pk: string,
  pick: (values: Values) => Values,
): ListResult<Values> {
  const matching = matched.length;
  const limit = options?.limit;
  const offset = options?.page && limit ? (options.page - 1) * limit : options?.offset ?? 0;

  let items = offset > 0 ? matched.slice(offset) : matched;
  const hasMore = limit ? items.length > limit : false;
  if (limit) items = items.slice(0, limit);

  const endCursor = items.length > 0
    ? String((items[items.length - 1] as Record<string, unknown>)[pk] ?? '')
    : undefined;

  const result = items.map(pick) as ListResult<Values>;
  result.hasMore = hasMore;
  result.endCursor = endCursor;
  if (options?.count) result.total = matching;

  return result;
}
