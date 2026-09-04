/** Collector(Type) — resolves one handler input parameter from the invocation context. */

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
