import type { Container } from '@fougere/container';
import type { Logger } from '../../builtin/Logger.js';
import type { OwnLogger } from '../../builtin/OwnLoggers.js';
import type { FrondDescriptor } from '../../descriptor/FrondDescriptor.js';
import type { ProviderEntry } from '../../descriptor/ProviderEntry.js';
import { lifetimeOf } from '../../lifetime.js';
import { collectorKeyOf } from '../../prefab/collector.js';

/**
 * Every collector of the frond under its own name, and as the realization of the port it extends —
 * `Collect<User>` — which the port machinery binds, with whatever stands in front of it.
 */
export function registerCollectors(frond: FrondDescriptor, scope: Container, ownLogger: OwnLogger, frondLog: Logger): ProviderEntry[] {
  for (const collector of frond.collectors) {
    scope.register(collector.ctor.name, collector.ctor, { deps: ownLogger(collector.ctor.name, collector.deps), ...lifetimeOf(collector.ctor) });
  }
  if (frond.collectors.length > 0) {
    frondLog.debug(`${frond.collectors.length} collector(s): ${frond.collectors.map((c) => c.typeName).join(', ')}`);
  }

  return frond.collectors.map(({ ctor, deps, filePath, typeName }) => ({ ctor, deps, filePath, name: ctor.name, implements: [collectorKeyOf(typeName)] }));
}
