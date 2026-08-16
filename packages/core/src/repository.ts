import { classNameOf, type EntityConstructor } from '@fougere/schema';
import type { EntityOrm } from './orm.js';

/**
 * Repository(Entity) — where an entity's reads and writes are named.
 *
 * `EntityOrm` is a port: five generic gestures, no flavour of domain. "The readings
 * of the last hour" is not one of them, so it used to be spelled at the call site —
 * `orm.list({ orderBy: 'at', order: 'desc', limit: 4096 })` followed by a filter in
 * JavaScript, sitting in the middle of the calculation it feeds. A query with no home
 * squats in the answer.
 *
 * So the port gains a place to be extended, per entity:
 *
 * ```ts
 * // repositories/ReadingRepository.ts
 * export default class ReadingRepository extends Repository(Reading) {
 *   since(moment: Date) {
 *     return this.orm.list({ where: { at: { gte: moment } } });
 *   }
 * }
 * ```
 *
 * A handler then asks the question and never spells the storage:
 *
 * ```ts
 * async hourly() {
 *   return average(await this.readings.since(anHourAgo()));
 * }
 * ```
 *
 * **Write none and you lose nothing.** The bootstrap registers a default repository
 * for every entity — the guarded ORM itself — so `ReadingRepository` resolves whether
 * or not the file exists. Declaring one wins, exactly as a `Crud` op redefined in the
 * subclass wins over the prefab. Convention, not configuration.
 *
 * It is NOT a door: a repository has no façade, so nothing here is reachable from the
 * wire. A judge still lives in the handler, which is the only place a refusal cannot
 * be walked around.
 */
/** What a repository is handed, and what it exposes to whoever holds it. */
export interface RepositoryOf<T> {
  /** The entity's port, already guarded — a value the shape forbids is refused here too. */
  orm: EntityOrm<T>;
}

export interface RepositoryConstructor<T> {
  new (orm: EntityOrm<T>): RepositoryOf<T>;
  readonly __entity: unknown;
}

export function Repository<E extends EntityConstructor>(entity: E): RepositoryConstructor<InstanceType<E>> {
  type T = InstanceType<E>;

  class RepositoryBase implements RepositoryOf<T> {
    static readonly __entity = entity;

    constructor(public orm: EntityOrm<T>) {}
  }

  return RepositoryBase as unknown as RepositoryConstructor<T>;
}

/** Container key of an entity's repository — 'reading' → 'ReadingRepository'. */
export function repositoryKeyOf(entity: string): string {
  return `${classNameOf(entity)}Repository`;
}
