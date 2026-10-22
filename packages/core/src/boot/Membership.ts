import type { Container } from '@fougere/container';
import type { SchemaView } from '@fougere/schema';
import type { Fronds } from '../descriptor/Fronds.js';
import type { RemoteRouter } from './remote.js';
import type { Dispatcher } from '../dispatch/Dispatcher.js';
import type { RouteRegistry } from '../dispatch/RouteRegistry.js';
import type { EffectiveOperationsMap } from '../EffectiveOperationsMap.js';
import type { Logger } from '../builtin/Logger.js';
import { addressOf, facadeKeyOf, isFacadeKey } from '../wire/Facade.js';
import { presenterKeyOf } from '../prefab/presenter.js';
import { callOperations } from '../entry/facade.js';
import { decoded } from '../dispatch/decoded.js';

/** The one wording for "nobody hosts this here", with both ways out. */
export const notLoaded = (entity: string) =>
  `The frond that serves ${entity} is not in this process.\n` +
  `  - Keep it in this process (only:), or\n` +
  `  - give it an address: fronds: { <frond>: { remote: 'http://...' } }`;

export function ownedBy<T>(fronds: Fronds, container: Container, entity: string, key: string): T | undefined {
  const owner = fronds.owner(entity);
  const scopeKey = `frond:${owner?.name}`;
  if (!owner || !container.has(scopeKey)) return undefined;

  const scope = container.resolve<Container>(scopeKey);

  return scope.has(key) ? scope.resolve<T>(key) : undefined;
}

/** What an app answers about what it serves is built from — every answer is about a SERVED entity. */
export interface Serving {
  container: Container;
  fronds: Fronds;
  remoteRouter: RemoteRouter | undefined;
  dispatcher: Dispatcher;
  localDispatcher: Dispatcher;
  routeRegistry: RouteRegistry;
  effectiveByKey: Map<string, EffectiveOperationsMap>;
  log: Logger;
}

/**
 * What an app answers about what it serves — the membership rule and its neighbours.
 *
 * `facadeFor` is THE rule, stated once: every projection reads it and nothing else.
 */
export class Membership {
  /** Said once per pair, so a facade that registers in a loop says it once. */
  private readonly saidAbsent = new Set<string>();

  constructor(private readonly serving: Serving) {}

  resolve<T>(name: string): T {
    try {
      return this.serving.container.resolve<T>(name);
    } catch (err) {
      if (isFacadeKey(name) && !this.serving.remoteRouter) throw new Error(notLoaded(addressOf(name)));
      throw err;
    }
  }

  async schemaFor(entity: string): Promise<SchemaView> {
    const { fronds, remoteRouter } = this.serving;
    const found = fronds.entity(entity);
    if (found) return found.entityClass;
    if (!remoteRouter) throw new Error(notLoaded(entity));

    // An address that stores nothing publishes ops and no shape. Saying so beats handing back
    // an empty schema, which would validate every input it was given.
    const stored = await remoteRouter.schemaOf(entity);
    if (!stored) {
      throw new Error(
        `${entity} is not stored by this process or any remote, so it has no schema here. Call its operations instead.`,
      );
    }

    return stored;
  }

  facadeFor(address: string, surface?: string): Record<string, Function> | undefined {
    const { fronds, dispatcher, localDispatcher, routeRegistry } = this.serving;
    if (!surface) return this.facadeAt(facadeKeyOf(address), true) && this.callsAt(address, undefined, dispatcher);

    const own = this.facadeAt(facadeKeyOf(address, surface), false) && this.callsAt(address, surface, localDispatcher);
    if (!fronds.owner(address)) {
      this.sayNoSurfaceAcross(address, surface);

      return own;
    }

    const admitted = fronds.admits(surface, address);
    if (admitted === false) return undefined;
    if (own || admitted === undefined) return own;

    const fallback = this.facadeAt(facadeKeyOf(address), false);

    return fallback
      ? callOperations(localDispatcher, address, routeRegistry.operationNames(address, surface), surface)
      : undefined;
  }

  operationsFor(address: string, surface?: string): EffectiveOperationsMap | undefined {
    const { fronds, effectiveByKey } = this.serving;
    if (!surface) return effectiveByKey.get(facadeKeyOf(address));

    const own = effectiveByKey.get(facadeKeyOf(address, surface));
    const admitted = fronds.admits(surface, address);
    if (admitted === false) return undefined;

    return admitted ? (own ?? effectiveByKey.get(facadeKeyOf(address))) : own;
  }

  presenterFor(entity: string): unknown | undefined {
    const { fronds, container } = this.serving;

    return ownedBy(fronds, container, entity, presenterKeyOf(entity));
  }

  private facadeAt(key: string, topology: boolean): Record<string, Function> | undefined {
    try {
      return topology
        ? this.resolve<Record<string, Function>>(key)
        : this.serving.container.resolve<Record<string, Function>>(key);
    } catch {
      return undefined;
    }
  }

  /**
   * What a door is handed for an address it may serve: the calls, not the facade code holds.
   * The names are the routes this process registered; an address served elsewhere has none
   * before it is reached, so its calls are named when they are made.
   */
  private callsAt(address: string, surface: string | undefined, through: Dispatcher): Record<string, Function> {
    const { routeRegistry, effectiveByKey } = this.serving;
    const names = routeRegistry.operationNames(address, surface);
    if (names.length === 0) return callOperations(through, address, undefined, surface);
    const effective = effectiveByKey.get(facadeKeyOf(address, surface));

    return callOperations(through, address, names, surface, (operation, answer) => decoded(effective?.get(operation)?.output, answer));
  }

  /**
   * A surface is declared in the frond that serves it. When that frond runs in another
   * process, this one never asked for its facades, and answering 'no' is the only thing a
   * synchronous rule can do — so it says so rather than registering nothing in silence.
   */
  private sayNoSurfaceAcross(entity: string, surface: string): void {
    if (!this.serving.remoteRouter || this.saidAbsent.has(`${surface}:${entity}`)) return;
    this.saidAbsent.add(`${surface}:${entity}`);
    this.serving.log.warn(
      `The surface '${surface}' of ${entity} is not served: its frond runs in another process. `
      + 'The default operations answer instead.',
    );
  }
}
