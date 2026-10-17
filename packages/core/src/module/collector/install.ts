import type { Container } from '@fougere/container';
import type { Logger } from '../../builtin/Logger.js';
import type { OwnLogger } from '../../builtin/OwnLoggers.js';
import type { FrondDescriptor } from '../../descriptor/FrondDescriptor.js';
import { lifetimeOf } from '../../lifetime.js';
import { collectorKeyOf } from '../../prefab/collector.js';

/** Every collector of the frond under its key — and the types they answer for. */
export function registerCollectors(frond: FrondDescriptor, scope: Container, ownLogger: OwnLogger, frondLog: Logger): Set<string> {
  for (const collector of frond.collectors) {
    scope.register(collectorKeyOf(collector.typeName), collector.ctor, { deps: ownLogger(collector.ctor.name, collector.deps), ...lifetimeOf(collector.ctor) });
  }
  if (frond.collectors.length > 0) {
    frondLog.debug(`${frond.collectors.length} collector(s): ${frond.collectors.map((c) => c.typeName).join(', ')}`);
  }

  return new Set(frond.collectors.map((collector) => collector.typeName));
}
