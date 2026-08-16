/**
 * Collector(Entity) — resolves handler input parameters from invocation context.
 *
 * The dual of Presenter: Presenter enriches output, Collector resolves input.
 *
 * Usage:
 * ```ts
 * export default class UserCollector extends Collector(User) {
 *   constructor(private userOrm: UserOrm) { super(); }
 *
 *   async collect(ctx: InvocationContext) {
 *     return this.userOrm.findById(ctx.state.userId as string);
 *   }
 * }
 * ```
 */

import type { EntityConstructor } from '@fougere/schema';

const COLLECTOR_TARGET = Symbol.for('fougere:collector_target');

export function Collector<E extends EntityConstructor>(entity: E) {
  class CollectorBase {
    static [COLLECTOR_TARGET] = entity;
  }
  return CollectorBase;
}

/** Get the entity class a collector targets. */
export function getCollectorTarget(ctor: Function): EntityConstructor | undefined {
  return (ctor as any)[COLLECTOR_TARGET];
}

/** Container key of an entity's collector — 'user' → 'UserCollector'. */
export function collectorKeyOf(entity: string): string {
  return `${entity[0].toUpperCase()}${entity.slice(1)}Collector`;
}
