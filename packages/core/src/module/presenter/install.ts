import type { Container } from '@fougere/container';
import type { Logger } from '../../builtin/Logger.js';
import type { OwnLogger } from '../../builtin/OwnLoggers.js';
import type { FrondDescriptor } from '../../descriptor/FrondDescriptor.js';
import type { ProviderEntry } from '../../descriptor/ProviderEntry.js';
import { lifetimeOf } from '../../lifetime.js';
import { presenterKeyOf } from '../../prefab/presenter.js';

/**
 * Every presenter of the frond under its own name, and as the realization of the port it extends —
 * `Present<Post>` — which the port machinery binds, with whatever stands in front of it.
 */
export function registerPresenters(frond: FrondDescriptor, scope: Container, ownLogger: OwnLogger, frondLog: Logger): ProviderEntry[] {
  for (const presenter of frond.presenters) {
    scope.register(presenter.ctor.name, presenter.ctor, { deps: ownLogger(presenter.ctor.name, presenter.deps), ...lifetimeOf(presenter.ctor) });
  }
  if (frond.presenters.length > 0) {
    frondLog.debug(`${frond.presenters.length} presenter(s): ${frond.presenters.map((p) => p.entityName).join(', ')}`);
  }

  return frond.presenters.map(({ ctor, deps, filePath, entityName }) => ({ ctor, deps, filePath, name: ctor.name, implements: [presenterKeyOf(entityName)] }));
}

/**
 * A presenter is about an entity — computed fields sit on a shape — so this walks entities.
 * Exposed lazily: the bridge resolves the chain on first access.
 */
export function exposePresenters(frond: FrondDescriptor, container: Container, scope: Container): void {
  for (const entity of frond.entities) {
    const presenterKey = presenterKeyOf(entity.name);
    if (!frond.presenters.some((presenter) => presenter.entityName === entity.name)) continue;

    let instance: Record<string | symbol, unknown> | undefined;
    container.registerValue(presenterKey, new Proxy({} as Record<string, unknown>, {
      get(_target, prop) {
        instance ??= scope.resolve<Record<string | symbol, unknown>>(presenterKey);

        return instance[prop];
      },
    }));
  }
}
