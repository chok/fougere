import type { CrudOpName } from './CrudOpName.js';
import type { EntityConstructor } from '@fougere/schema';
import type { Storage, ListOptions, ListResult } from '../storage/port.js';

/** The view an op emits, fabricated. */
type OutOf<V, K extends CrudOpName, T> =
  // Bracketed on purpose: a naked `V extends …` DISTRIBUTES, and the no-view default
  // is the empty map, whose `keyof` is `never` — distribution would then collapse
  // every op's output to `never` instead of falling through to the entity.
  [V] extends [EntityConstructor] ? InstanceType<V & EntityConstructor>
  : K extends keyof V ? (V[K] extends EntityConstructor ? InstanceType<V[K]> : T)
  : T;

/** The five ops, typed from the entity and its views. */
export interface CrudOps<T, V = {}> {
  storage: Storage<T>;
  list(options?: ListOptions, ...collected: never[]): Promise<ListResult<OutOf<V, 'list', T>>>;
  findById(id: string, ...collected: never[]): Promise<OutOf<V, 'findById', T> | undefined>;
  create(input: Partial<T>, ...collected: never[]): Promise<OutOf<V, 'create', T>>;
  update(id: string, input: Partial<T>, ...collected: never[]): Promise<OutOf<V, 'update', T>>;
  delete(id: string, ...collected: never[]): Promise<boolean>;
}
