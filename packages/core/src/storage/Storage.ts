import { upperFirst, lowerFirst, type SchemaView } from '@fougere/schema';
import type { ListOptions } from './ListOptions.js';
import type { ListResult } from './ListResult.js';
import type { SelectOption } from './SelectOption.js';
import { ErrorCode } from '../wire/ErrorCode.js';
import { FougereError } from '../wire/FougereError.js';

/** The keys `list()` answers to, checked against `ListOptions` so neither can drift. */
const LIST_OPTION_KEYS = Object.keys({
  limit: true, offset: true, page: true, after: true, orderBy: true, order: true, count: true, where: true, select: true,
} satisfies Record<keyof (ListOptions & SelectOption), true>);

/** What a count must be — a text that did not read as a number arrives as `NaN`. */
const COUNTS = ['limit', 'offset', 'page'] as const;

/**
 * Refuse an option the port does not answer to, a count that is not one, and an order by a
 * field the entity does not declare — an unhonoured `orderBy` returns the page in whatever order
 * the engine chose. Refused as BAD_REQUEST: a plain Error left as INTERNAL_ERROR, its message hidden.
 */
export function assertListOptions(
  options: object | undefined,
  entity: string,
  declared: readonly string[],
): void {
  if (!options) return;
  const strangers = Object.keys(options).filter((key) => !LIST_OPTION_KEYS.includes(key));
  if (strangers.length > 0) {
    refuse(
      `${entity}.list(): unknown option ${strangers.map((s) => `\`${s}\``).join(', ')}. ` +
      `Known options are ${LIST_OPTION_KEYS.join(', ')} — to filter, pass \`where: { ${strangers[0]}: … }\`.`,
    );
  }

  for (const count of COUNTS) {
    const value = (options as ListOptions)[count];
    if (value !== undefined && !(Number.isInteger(value) && value >= 0)) {
      refuse(`${entity}.list(): \`${count}\` is ${typeof value === 'number' ? value : JSON.stringify(value)}, not a whole number.`);
    }
  }

  const { orderBy } = options as ListOptions;
  if (orderBy === undefined || declared.includes(orderBy)) return;

  refuse(`${entity}.list(): unknown orderBy \`${orderBy}\`. ${entity} declares ${declared.join(', ')}.`);
}

function refuse(message: string): never {
  throw new FougereError({ code: ErrorCode.BAD_REQUEST, message });
}

/** Per-entity storage — scoped CRUD operations on a single entity type. */
export interface Storage<T = Record<string, unknown>> {
  list(options?: ListOptions & SelectOption): Promise<ListResult<T>>;
  findById(id: string, options?: SelectOption): Promise<T | undefined>;
  /**
   * Read by criteria — `findBy({ email })` for the one, `findAllBy({ orderId })` for the many,
   * which is what a one-to-many relation *is*.
   */
  findBy(criteria: Partial<T> | Record<string, unknown>, options?: SelectOption): Promise<T | undefined>;
  findAllBy(criteria: Partial<T> | Record<string, unknown>, options?: SelectOption): Promise<T[]>;
  /**
   * Read a SET of rows by their key, in one go — the gesture every other one was being bent into.
   */
  findByKeys(ids: readonly string[], options?: SelectOption): Promise<Map<string, T>>;
  /** The dual of `findByKeys`: many rows per key, not one. */
  findAllByKeys(field: string, keys: readonly string[], options?: SelectOption): Promise<Map<string, T[]>>;
  create(input: Partial<T>, options?: SelectOption): Promise<T>;
  /** Write the row, or make the existing one look like this — one statement. */
  upsert(input: Partial<T>, options?: SelectOption): Promise<T>;
  /** A whole page in one statement — what an import writes through. */
  upsertAll(inputs: readonly Partial<T>[], options?: SelectOption): Promise<number>;
  update(id: string, input: Partial<T>, options?: SelectOption): Promise<T>;
  delete(id: string): Promise<boolean>;
  /** Returns a scoped storage that restricts all read results to the fields of the given schema. */
  output(schema: SchemaView): Storage<T>;
}

/**
 * What each link of a chain stands in front of.
 *
 * A SYMBOL on the instance, set through a cast so it joins no declaration: `Storage` is an
 * interface as well as a class, and the realizations satisfy it structurally —
 * `storageOver` returns an object literal, and one more member would stop it being a
 * storage. A `#private` field says the same thing and makes the class NOMINAL, which
 * refuses every realization at once.
 *
 * On the instance and not in a `WeakMap` beside it, because `StorageGuard.guard` hands out
 * `Object.create(storage)` — a new object whose prototype is the link. A symbol is found
 * through that chain; a map keyed on the link is not, and the guarded object read
 * `undefined`.
 */
const BEHIND = Symbol('fougere.storage.behind');

const behind = <T>(link: object): Storage<T> =>
  (link as Record<symbol, unknown>)[BEHIND] as Storage<T>;

/**
 * A storage that stands in front of another — the base a wrapper extends, and the only
 * thing that makes `Storage` a seam rather than a shape.
 *
 * Merged with the interface above, so the class carries the thirteen gestures as a TYPE
 * while its prototype carries them as a FORWARD. A wrapper writes what it changes and
 * nothing else:
 *
 * ```ts
 * class Audit extends Storage {
 *   constructor(private inner: Storage) { super(inner); }
 *   async create(row) { await say(row); return this.inner.create(row); }
 * }
 * ```
 *
 * `ports: { Storage: ['Audit'] }` orders the chain when a frond declares two, which is the
 * same key, the same order and the same refusals a port gets. A realization does not extend
 * this: it is handed in by `storageFactory` and is the last link, so what a wrapper does not
 * override reaches it through these forwards.
 *
 * Documented: [storage](https://fougere.dev/docs/business/storage) and
 * [ports](https://fougere.dev/docs/business/ports).
 */
export abstract class Storage<T = Record<string, unknown>> {
  constructor(inner: Storage<T>) {
    (this as Record<symbol, unknown>)[BEHIND] = inner;
  }

  list(options?: ListOptions & SelectOption): Promise<ListResult<T>> { return behind<T>(this).list(options); }
  findById(id: string, options?: SelectOption): Promise<T | undefined> { return behind<T>(this).findById(id, options); }
  findBy(criteria: Partial<T> | Record<string, unknown>, options?: SelectOption): Promise<T | undefined> {
    return behind<T>(this).findBy(criteria, options);
  }
  findAllBy(criteria: Partial<T> | Record<string, unknown>, options?: SelectOption): Promise<T[]> {
    return behind<T>(this).findAllBy(criteria, options);
  }
  findByKeys(ids: readonly string[], options?: SelectOption): Promise<Map<string, T>> {
    return behind<T>(this).findByKeys(ids, options);
  }
  findAllByKeys(field: string, keys: readonly string[], options?: SelectOption): Promise<Map<string, T[]>> {
    return behind<T>(this).findAllByKeys(field, keys, options);
  }
  create(input: Partial<T>, options?: SelectOption): Promise<T> { return behind<T>(this).create(input, options); }
  upsert(input: Partial<T>, options?: SelectOption): Promise<T> { return behind<T>(this).upsert(input, options); }
  upsertAll(inputs: readonly Partial<T>[], options?: SelectOption): Promise<number> {
    return behind<T>(this).upsertAll(inputs, options);
  }
  update(id: string, input: Partial<T>, options?: SelectOption): Promise<T> {
    return behind<T>(this).update(id, input, options);
  }
  delete(id: string): Promise<boolean> { return behind<T>(this).delete(id); }
  output(schema: SchemaView): Storage<T> { return behind<T>(this).output(schema); }
  /** What this storage wraps — the Kysely instance for the SQL one, something else elsewhere. */
  get client(): unknown { return behind<T>(this).client; }
}

/** Container key of an entity's storage — 'reading' → 'ReadingStorage'. */
export function storageKeyOf(entity: string): string {
  return `${upperFirst(entity)}${HELD}`;
}

/** The entity behind a storage key, or `undefined` when the key is not one. */
export function entityOfStorageKey(key: string, known: (entity: string) => boolean): string | undefined {
  if (key.length <= HELD.length || !key.endsWith(HELD)) return undefined;
  const entity = lowerFirst(key.slice(0, -HELD.length));

  return storageKeyOf(entity) === key && known(entity) ? entity : undefined;
}

/** What a holder keeps, said in the key it is registered under. */
const HELD = 'Storage';

/**
 * The container key of a frame — `[['Account', 'Ledger'], ['RateMirror']]` →
 * 'Account+Ledger|RateMirrorTogether'.
 */
export function togetherKeyOf(entities: readonly string[], providers: readonly string[] = []): string {
  const named = entities.map(upperFirst).join(SEPARATOR);

  return `${named}${providers.length ? KINDS + providers.map(upperFirst).join(SEPARATOR) : ''}${FRAME}`;
}

const FRAME = 'Together';

const SEPARATOR = '+';

/** Separates the two lists — what the unwind covers, and what is rebuilt to make it true. */
const KINDS = '|';

/** The members behind a frame key, or `undefined` when the key is not one. */
export function membersOfTogetherKey(key: string): { entities: string[]; providers: string[] } | undefined {
  if (key.length <= FRAME.length || !key.endsWith(FRAME)) return undefined;
  const [entities = '', providers = ''] = key.slice(0, -FRAME.length).split(KINDS);
  const split = (list: string) => list.split(SEPARATOR).filter(Boolean);

  return { entities: split(entities), providers: split(providers) };
}
