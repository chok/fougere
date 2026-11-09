import type { Container } from '@fougere/container';
import { lowerFirst } from '@fougere/schema';
import type { BindingSourceType } from '../../wire/BindingSourceType.js';
import { collectorKeyOf } from '../../prefab/collector.js';
import { collectedAs } from './collectedAs.js';
import type { CollectorResolver } from './CollectorResolver.js';

function collectorIn(scope: Container | undefined, typeName: string): CollectorResolver | undefined {
  try { return scope?.resolve<CollectorResolver>(collectorKeyOf(typeName)); }
  catch { return undefined; }
}

/**
 * A parameter whose type has a collector in the frond.
 * Ex: `user: User` beside a `Collect<User>`.
 */
export const collector: BindingSourceType<'collector'> = {
  bind(param, collectorTypeNames) {
    const typeName = lowerFirst(param.type.name);

    return collectorTypeNames.has(typeName) ? { kind: 'collector', typeName } : undefined;
  },
  async resolve(source, { ctx, scope }) {
    const found = collectorIn(scope, source.typeName);

    return found ? collectedAs(found, await found.collect(ctx)) : undefined;
  },
  missing(source, { ctx, scope }) {
    collectorIn(scope, source.typeName)?.missing?.(ctx);
  },
  given(source, value, { scope }) {
    const found = collectorIn(scope, source.typeName);

    return found ? collectedAs(found, value) : value;
  },
};
