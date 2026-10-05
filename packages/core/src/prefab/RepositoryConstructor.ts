import { upperFirst, type Entity } from '@fougere/schema';
import type { ListOptions } from '../storage/ListOptions.js';
import type { ListResult } from '../storage/ListResult.js';
import type { SelectOption } from '../storage/SelectOption.js';
import type { Storage } from '../storage/Storage.js';
import type { SchemaView } from '@fougere/schema';
import type { AggregateOf } from './AggregateOf.js';
import type { AggregateConstructor } from './AggregateConstructor.js';

/** The single-entity form: the port, plus whatever the subclass names. */
export interface RepositoryConstructor<T> {
  new (storage: Storage<T>): Storage<T>;
  readonly __entity: unknown;
}

/** What an aggregate's subclass sees. */
declare abstract class AggregateShape<E extends readonly Entity[]> {
  protected storages: { [K in keyof E]: Storage<InstanceType<E[K]>> };
}

export function Repository<E extends Entity>(entity: E): RepositoryConstructor<InstanceType<E>>;

export function Repository<E extends readonly [Entity, Entity, ...Entity[]]>(
  ...entities: E
): AggregateConstructor<E>;

export function Repository(...entities: Entity[]): unknown {
  return entities.length === 1 ? one(entities[0]) : many(entities);
}

/** The port forwarded, member by member. */
function one<E extends Entity>(entity: E): RepositoryConstructor<InstanceType<E>> {
  type T = InstanceType<E>;

  class RepositoryBase implements Storage<T> {
    static readonly __entity = entity;

    constructor(protected storage: Storage<T>) {}

    list(options?: ListOptions & SelectOption): Promise<ListResult<T>> { return this.storage.list(options); }
    findById(id: string, options?: SelectOption) { return this.storage.findById(id, options); }
    findBy(criteria: Partial<T> | Record<string, unknown>, options?: SelectOption) { return this.storage.findBy(criteria, options); }
    findAllBy(criteria: Partial<T> | Record<string, unknown>, options?: SelectOption) { return this.storage.findAllBy(criteria, options); }
    findByKeys(ids: readonly string[], options?: SelectOption) { return this.storage.findByKeys(ids, options); }
    findAllByKeys(field: string, keys: readonly string[], options?: SelectOption) { return this.storage.findAllByKeys(field, keys, options); }
    create(input: Partial<T>, options?: SelectOption) { return this.storage.create(input, options); }
    upsert(input: Partial<T>, options?: SelectOption) { return this.storage.upsert(input, options); }
    upsertAll(inputs: readonly Partial<T>[], options?: SelectOption) { return this.storage.upsertAll(inputs, options); }
    update(id: string, input: Partial<T>, options?: SelectOption) { return this.storage.update(id, input, options); }
    delete(id: string) { return this.storage.delete(id); }
    output(schema: SchemaView) { return this.storage.output(schema); }
    get client(): unknown { return this.storage.client; }
  }

  return RepositoryBase as unknown as RepositoryConstructor<T>;
}

/** The aggregate. */
function many<E extends readonly Entity[]>(entities: E): AggregateConstructor<E> {
  class AggregateBase {
    static readonly __entity = entities[0];
    static readonly __owns = entities;

    protected storages: AggregateOf<E>;

    constructor(...storages: unknown[]) {
      this.storages = storages.slice(0, entities.length) as AggregateOf<E>;
    }
  }

  return AggregateBase as unknown as AggregateConstructor<E>;
}

/** Container key of an entity's repository — 'reading' → 'ReadingRepository'. */
export function repositoryKeyOf(entity: string): string {
  return `${upperFirst(entity)}Repository`;
}

/** The entities a class owns — empty for anything that is not an aggregate. */
export function ownedBy(ctor: unknown): readonly Entity[] {
  return (ctor as { __owns?: readonly Entity[] } | undefined)?.__owns ?? [];
}
