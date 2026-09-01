/**
 * Collector(Type) — resolves one handler input parameter from the invocation context.
 *
 * The target is a NAME matched against the parameter's type, never a schema: nothing
 * here nor in the scan reads its fields. So `Ability`, built per call from state, sits
 * beside `User`, loaded from a row.
 *
 * The dual of Presenter only in direction. A presenter's subject is a ROW — it adds
 * computed fields to one, so its target must be an entity. A collector's subject is a
 * PARAMETER.
 *
 * Usage:
 * ```ts
 * export default class UserCollector extends Collector(User) {
 *   constructor(private userStorage: UserStorage) { super(); }
 *
 *   async collect(ctx: InvocationContext) {
 *     return this.userStorage.findById(ctx.state.userId as string);
 *   }
 * }
 * ```
 */

import { upperFirst } from '@fougere/schema';

export function Collector<T extends abstract new (...args: any[]) => any>(target: T) {
  class CollectorBase {
    static readonly __entity = target;
  }
  return CollectorBase;
}

/** Container key of a collector — 'user' → 'UserCollector', 'ability' → 'AbilityCollector'. */
export function collectorKeyOf(type: string): string {
  return `${upperFirst(type)}Collector`;
}
