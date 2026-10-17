import type { Container } from '@fougere/container';
import type { Logger } from '../../builtin/Logger.js';
import type { OwnLogger } from '../../builtin/OwnLoggers.js';
import type { FrondDescriptor } from '../../descriptor/FrondDescriptor.js';
import type { PresenterEntry } from '../../descriptor/PresenterEntry.js';
import { lifetimeOf } from '../../lifetime.js';
import { presenterKeyOf } from '../../prefab/presenter.js';

/** Every presenter of the frond under its key — and the presenters by the entity they sit on. */
export function registerPresenters(frond: FrondDescriptor, scope: Container, ownLogger: OwnLogger, frondLog: Logger): Map<string, PresenterEntry> {
  for (const presenter of frond.presenters) {
    scope.register(presenterKeyOf(presenter.entityName), presenter.ctor, { deps: ownLogger(presenter.ctor.name, presenter.deps), ...lifetimeOf(presenter.ctor) });
  }
  if (frond.presenters.length > 0) {
    frondLog.debug(`${frond.presenters.length} presenter(s): ${frond.presenters.map((p) => p.entityName).join(', ')}`);
  }

  return new Map(frond.presenters.map((presenter) => [presenter.entityName, presenter]));
}

/**
 * A presenter is about an entity — computed fields sit on a shape — so this walks entities.
 * Exposed lazily: the bridge resolves the instance on first access.
 */
export function exposePresenters(
  frond: FrondDescriptor,
  presenterMap: Map<string, unknown>,
  container: Container,
  scope: Container,
): void {
  for (const entity of frond.entities) {
    if (!presenterMap.has(entity.name)) continue;

    const presenterKey = presenterKeyOf(entity.name);
    let instance: Record<string | symbol, unknown> | undefined;
    container.registerValue(presenterKey, new Proxy({} as Record<string, unknown>, {
      get(_target, prop) {
        instance ??= scope.resolve<Record<string | symbol, unknown>>(presenterKey);

        return instance[prop];
      },
    }));
  }
}
