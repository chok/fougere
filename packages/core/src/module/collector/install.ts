import type { Container } from '@fougere/container';
import type { Logger } from '../../builtin/Logger.js';
import type { OwnLogger } from '../../builtin/OwnLoggers.js';
import type { FrondDescriptor } from '../../descriptor/FrondDescriptor.js';
import { lifetimeOf } from '../../lifetime.js';

/** Every collector of the frond under its own name — `realizationsOf` is what binds it under `Collect<User>`. */
export function registerCollectors(frond: FrondDescriptor, scope: Container, ownLogger: OwnLogger, frondLog: Logger): void {
  for (const collector of frond.collectors) {
    scope.register(collector.ctor.name, collector.ctor, { deps: ownLogger(collector.ctor.name, collector.deps), ...lifetimeOf(collector.ctor) });
  }
  if (frond.collectors.length > 0) {
    frondLog.debug(`${frond.collectors.length} collector(s): ${frond.collectors.map((c) => c.typeName).join(', ')}`);
  }
}
