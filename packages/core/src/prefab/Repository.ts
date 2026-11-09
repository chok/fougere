import { subjectKeyOf } from '../wire/SubjectKey.js';
import { lowerFirst, upperFirst, type Entity, type SchemaView } from '@fougere/schema';
import type { ListOptions } from '../storage/ListOptions.js';
import type { ListResult } from '../storage/ListResult.js';
import type { SelectOption } from '../storage/SelectOption.js';
import type { Change } from '../storage/Change.js';
import type { Storage } from '../storage/Storage.js';
import { storageKeyOf } from '../storage/Storage.js';
import { crudOps } from './RepositoryOps.js';

const ROWS = Symbol.for('fougere.rows');

type Rows<A, B, C, D> = [Storage<A>, ...([B] extends [never] ? [] : [Storage<B>]), ...([C] extends [never] ? [] : [Storage<C>]), ...([D] extends [never] ? [] : [Storage<D>])];

/**
 * The rows of an entity; extended by a handler, it serves `list`, `findById`, `create`, `update`, `delete`.
 * Ex: `Repository<Account, Ledger>` owns both tables and forwards nothing.
 *
 * Documented: [repositories](https://fougere.dev/docs/concepts/repository).
 */
export abstract class Repository<A, B = never, C = never, D = never> {
  /** Each entity's rows, in the order the type arguments name them — what an aggregate writes through. */
  protected get storages(): Rows<A, B, C, D> {
    return rowsOf(this) as Rows<A, B, C, D>;
  }

  list(options?: ListOptions & SelectOption): Promise<ListResult<A>> { return one<A>(this as never).list(options); }
  findById(id: string, options?: SelectOption): Promise<A | undefined> { return one<A>(this as never).findById(id, options); }
  findBy(criteria: Partial<A> | Record<string, unknown>, options?: SelectOption): Promise<A | undefined> { return one<A>(this as never).findBy(criteria, options); }
  findAllBy(criteria: Partial<A> | Record<string, unknown>, options?: SelectOption): Promise<A[]> { return one<A>(this as never).findAllBy(criteria, options); }
  findByKeys(ids: readonly string[], options?: SelectOption): Promise<Map<string, A>> { return one<A>(this as never).findByKeys(ids, options); }
  findAllByKeys(field: string, keys: readonly string[], options?: SelectOption): Promise<Map<string, A[]>> { return one<A>(this as never).findAllByKeys(field, keys, options); }
  create(input: Partial<A>, options?: SelectOption): Promise<A> { return one<A>(this as never).create(input, options); }
  createAll(inputs: readonly Partial<A>[], options?: SelectOption): Promise<A[]> { return one<A>(this as never).createAll(inputs, options); }
  upsert(input: Partial<A>, options?: SelectOption): Promise<A> { return one<A>(this as never).upsert(input, options); }
  upsertAll(inputs: readonly Partial<A>[], options?: SelectOption): Promise<number> { return one<A>(this as never).upsertAll(inputs, options); }
  update(id: string, input: Partial<A>, options?: SelectOption): Promise<A> { return one<A>(this as never).update(id, input, options); }
  updateByKeys(ids: readonly string[], change: Change<A>, options?: SelectOption): Promise<Map<string, A>> { return one<A>(this as never).updateByKeys(ids, change, options); }
  delete(id: string): Promise<boolean> { return one<A>(this as never).delete(id); }
  output(schema: SchemaView): Storage<A> { return one<A>(this as never).output(schema); }
  get client(): unknown { return one<A>(this as never).client; }
}

function rowsOf(repository: object): Storage[] {
  const rows = (repository as { [ROWS]?: Storage[] })[ROWS];
  if (!rows) {
    throw new Error(`${repository.constructor.name} reached its rows before the boot handed them over — `
      + 'a constructor of its own cannot read them yet.');
  }

  return rows;
}

function one<A>(repository: Repository<A, unknown, unknown, unknown>): Storage<A> {
  const rows = rowsOf(repository);
  if (rows.length > 1) {
    throw new Error(`${repository.constructor.name} owns ${rows.length} entities, so it forwards no gesture: `
      + 'write through this.storages.');
  }

  return rows[0] as Storage<A>;
}

/** Whether a class extends `Repository` — read off its prototype by a name two copies of core share. */
export function isRepository(ctor: unknown): boolean {
  return typeof ctor === 'function' && (ctor.prototype as Record<symbol, unknown> | undefined)?.[REPOSITORY] === true;
}

const REPOSITORY = Symbol.for('fougere.repository');
Object.defineProperty(Repository.prototype, REPOSITORY, { value: true });

/** The class the boot builds from one written on `Repository<…>`, handed each entity's rows after its own dependencies. */
export function seated<T extends abstract new (...args: never[]) => unknown>(ctor: T, entities: readonly Entity[]): T {
  const seats = SEATED.get(ctor) ?? [];
  const known = seats.find((seat) => seat.entities.length === entities.length && seat.entities.every((one, i) => one === entities[i]));
  if (known) return known.seated as T;

  const Written = ctor as unknown as new (...args: unknown[]) => object;
  const count = entities.length;
  const stored = entities.map(storedOf);
  const Seated = class extends Written {
    static readonly __entity = stored[0];
    static readonly __output = entities[0];
    static readonly __owns = count > 1 ? stored : undefined;
    static readonly __ops = count === 1 ? crudOps(stored[0]!) : {};
    static readonly __seated = entities;

    constructor(...args: unknown[]) {
      super(...args.slice(0, args.length - count));
      Object.defineProperty(this, ROWS, { value: args.slice(args.length - count), enumerable: false });
    }
  };
  Object.defineProperty(Seated, 'name', { value: Written.name });
  Object.defineProperty(Seated, 'length', { value: Written.length + count });
  SEATED.set(ctor, [...seats, { entities, seated: Seated }]);

  return Seated as unknown as T;
}

const SEATED = new WeakMap<object, { entities: readonly Entity[]; seated: unknown }[]>();

/** The storage keys a seated class is handed after its own dependencies, in the order it owns them. */
export function seatsOf(entities: readonly Entity[]): string[] {
  return entities.map((entity) => storageKeyOf(lowerFirst(storedOf(entity).name)));
}

function storedOf(entity: Entity): Entity {
  const { derivation, anchored } = entity as unknown as { derivation?: { anchor: Entity }; anchored?: boolean };

  return derivation && !anchored ? derivation.anchor : entity;
}

/** The entities a class was seated on — empty for one that is not. */
export function seatOf(ctor: unknown): readonly Entity[] {
  return (ctor as { __seated?: readonly Entity[] } | undefined)?.__seated ?? [];
}

/** Container key of an entity's repository — 'reading' → 'ReadingRepository'. */
export function repositoryKeyOf(entity: string): string {
  return subjectKeyOf('Repository', upperFirst(entity));
}

/** The entities a class owns — empty for anything that is not an aggregate. */
export function ownedBy(ctor: unknown): readonly Entity[] {
  return (ctor as { __owns?: readonly Entity[] } | undefined)?.__owns ?? [];
}
