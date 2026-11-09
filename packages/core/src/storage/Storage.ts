import { subjectKeyOf, subjectsOf } from '../wire/SubjectKey.js';
import { upperFirst, lowerFirst, type SchemaView } from '@fougere/schema';
import type { ListOptions } from './ListOptions.js';
import type { ListResult } from './ListResult.js';
import type { SelectOption } from './SelectOption.js';
import type { Change } from './Change.js';
import { ErrorCode } from '../wire/ErrorCode.js';
import { FougereError } from '../wire/FougereError.js';

/** The keys `list()` answers to, checked against `ListOptions` so neither can drift. */
export const LIST_OPTION_KEYS = Object.keys({
  limit: true, offset: true, page: true, after: true, orderBy: true, order: true, count: true, where: true, select: true,
} satisfies Record<keyof (ListOptions & SelectOption), true>);

const COUNTS = ['limit', 'offset', 'page'] as const;

/** Refuses, as `BAD_REQUEST`, an option the port does not take, a bad count, or an order by an unknown field. */
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
   * Reads by criteria.
   * Ex: `findBy({ email })`, `findAllBy({ orderId })`.
   */
  findBy(criteria: Partial<T> | Record<string, unknown>, options?: SelectOption): Promise<T | undefined>;
  findAllBy(criteria: Partial<T> | Record<string, unknown>, options?: SelectOption): Promise<T[]>;
  /** Reads a set of rows by their key, in one go. */
  findByKeys(ids: readonly string[], options?: SelectOption): Promise<Map<string, T>>;
  /** The dual of `findByKeys`: many rows per key, not one. */
  findAllByKeys(field: string, keys: readonly string[], options?: SelectOption): Promise<Map<string, T[]>>;
  create(input: Partial<T>, options?: SelectOption): Promise<T>;
  /** Several rows in one statement, answered in the order they were given. */
  createAll(inputs: readonly Partial<T>[], options?: SelectOption): Promise<T[]>;
  /** Write the row, or make the existing one look like this — one statement. */
  upsert(input: Partial<T>, options?: SelectOption): Promise<T>;
  /** A whole page in one statement — what an import writes through. */
  upsertAll(inputs: readonly Partial<T>[], options?: SelectOption): Promise<number>;
  /**
   * Writes these values, or the ones `change` computes from the row, with no other write in between.
   * Ex: `update(id, (row) => ({ stock: row.stock - 1 }))`.
   */
  update(id: string, input: Partial<T> | Change<T>, options?: SelectOption): Promise<T>;
  /** `update(id, change)` over a set of rows, all held at once; a missing key refuses them all. */
  updateByKeys(ids: readonly string[], change: Change<T>, options?: SelectOption): Promise<Map<string, T>>;
  delete(id: string): Promise<boolean>;
  /** Returns a scoped storage that restricts all read results to the fields of the given schema. */
  output(schema: SchemaView): Storage<T>;
}

const BEHIND = Symbol('fougere.storage.behind');

const behind = <T>(link: object): Storage<T> =>
  (link as Record<symbol, unknown>)[BEHIND] as Storage<T>;

/**
 * A storage standing in front of another: the base a wrapper extends, forwarding what it does not override.
 * Ex: `class Audit extends Storage { constructor(private inner: Storage) { super(inner); } }`.
 *
 * Documented: [storage](https://fougere.dev/docs/extending/source-adapter) and [ports](https://fougere.dev/docs/concepts/port).
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
  createAll(inputs: readonly Partial<T>[], options?: SelectOption): Promise<T[]> { return behind<T>(this).createAll(inputs, options); }
  upsert(input: Partial<T>, options?: SelectOption): Promise<T> { return behind<T>(this).upsert(input, options); }
  upsertAll(inputs: readonly Partial<T>[], options?: SelectOption): Promise<number> {
    return behind<T>(this).upsertAll(inputs, options);
  }
  update(id: string, input: Partial<T> | Change<T>, options?: SelectOption): Promise<T> {
    return behind<T>(this).update(id, input, options);
  }
  updateByKeys(ids: readonly string[], change: Change<T>, options?: SelectOption): Promise<Map<string, T>> {
    return behind<T>(this).updateByKeys(ids, change, options);
  }
  delete(id: string): Promise<boolean> { return behind<T>(this).delete(id); }
  output(schema: SchemaView): Storage<T> { return behind<T>(this).output(schema); }
  /** What this storage wraps — the Kysely instance for the SQL one, something else elsewhere. */
  get client(): unknown { return behind<T>(this).client; }
}

/** Container key of an entity's storage — 'reading' → 'ReadingStorage'. */
export function storageKeyOf(entity: string): string {
  return subjectKeyOf('Storage', upperFirst(entity));
}

/** The entity behind a storage key, or `undefined` when the key is not one. */
export function entityOfStorageKey(key: string, known: (entity: string) => boolean): string | undefined {
  const subjects = subjectsOf(key, 'Storage');
  const entity = subjects?.length === 1 ? lowerFirst(subjects[0]!) : undefined;

  return entity !== undefined && known(entity) ? entity : undefined;
}

/**
 * The container key of a frame, spelled as the type is written.
 * Ex: `[['Account', 'Ledger']]` → `Together<[Account, Ledger]>`.
 */
export function togetherKeyOf(entities: readonly string[], providers: readonly string[] = []): string {
  const tuple = (names: readonly string[]) => `[${names.map(upperFirst).join(', ')}]`;

  return subjectKeyOf('Together', tuple(entities), ...(providers.length ? [tuple(providers)] : []));
}

/** The members behind a frame key, or `undefined` when the key is not one. */
export function membersOfTogetherKey(key: string): { entities: string[]; providers: string[] } | undefined {
  const [entities, providers = '[]'] = subjectsOf(key, 'Together') ?? [];
  if (entities === undefined) return undefined;
  const split = (tuple: string) => tuple.replace(/^\[|\]$/g, '').split(',').map((one) => one.trim()).filter(Boolean);

  return { entities: split(entities), providers: split(providers) };
}
