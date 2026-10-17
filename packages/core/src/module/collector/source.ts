import type { Container } from '@fougere/container';
import { lowerFirst } from '@fougere/schema';
import type { BindingSourceType } from '../../wire/BindingSourceType.js';
import { collectorKeyOf } from '../../prefab/collector.js';
import { collectedAs } from './collectedAs.js';
import type { CollectorResolver } from './CollectorResolver.js';

/** The collector the handler's scope holds for a type, when one does. */
function collectorIn(scope: Container | undefined, typeName: string): CollectorResolver | undefined {
  try { return scope?.resolve<CollectorResolver>(collectorKeyOf(typeName)); }
  catch { return undefined; }
}

/**
 * A parameter whose TYPE has a collector in the frond — `user: User` beside a `Collector(User)`.
 * The set is keyed `lowerFirst`, the way the scan spells it, never `toLowerCase()`: `AuthorUser`
 * looked up as `authoruser` missed `authorUser` and fell through to the request input.
 */
export const collector: BindingSourceType<'collector'> = {
  claim(param, collectorTypeNames) {
    const typeName = lowerFirst(param.type.name);

    return collectorTypeNames.has(typeName) ? { kind: 'collector', typeName } : undefined;
  },
  async resolve(source, { ctx, scope }) {
    const found = collectorIn(scope, source.typeName);

    return found ? collectedAs(found, await found.collect(ctx)) : undefined;
  },
  given(source, value, { scope }) {
    const found = collectorIn(scope, source.typeName);

    return found ? collectedAs(found, value) : value;
  },
};
