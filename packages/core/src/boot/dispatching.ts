import { DoorEvent } from '../dispatch/DoorEvent.js';
import type { Fronds } from '../descriptor/Fronds.js';
import { serveRelationReadings } from '../module/relation/readings.js';
import type { RowHosts } from '../module/relation/RowHosts.js';
import type { Journal } from '../wire/Journal.js';
import type { App } from './App.js';
import type { CreateAppOptions } from './CreateAppOptions.js';
import type { AppMiddleware } from '../wire/AppMiddleware.js';
import { Logger } from '../builtin/Logger.js';
import { request } from '../slots.js';
import { InFlight } from '../dispatch/InFlight.js';
import { RPC_ADDRESS } from '../wire/RpcAnswer.js';
import { identityCardOf } from './card.js';
import { type Storage } from '../storage/Storage.js';
import { RouteAddress } from '../wire/RouteAddress.js';
import { DispatchLifecycle } from '../dispatch/DispatchLifecycle.js';
import { Dispatcher } from '../dispatch/Dispatcher.js';
import { LocalRoutePolicy } from '../dispatch/LocalRoutePolicy.js';
import { OperationRoute } from '../dispatch/OperationRoute.js';
import { RouteRegistry } from '../dispatch/RouteRegistry.js';

export function serveCoreRpc(
  app: App,
  rowHosts: RowHosts,
  storageFor: (entity: string) => Storage | undefined,
): void {
  app.serveRpc('discover', (_invocation, surface) => identityCardOf(app, surface));
  serveRelationReadings(app.serveRpc, rowHosts, storageFor);
}

interface Dispatching {
  /** Counted at the one facade every caller goes through, so releasing can wait for the work. */
  inflight: InFlight;
  /** Where a late observer is added — `App.observe` is its only caller. */
  dispatchLifecycle: DispatchLifecycle;
  routeRegistry: RouteRegistry;
  /** Follows the topology — a local façade and a remote doublure alike. */
  dispatcher: Dispatcher;
  /** Stays home: what this process serves, and nothing else. */
  localDispatcher: Dispatcher;
  getMiddlewares(address: string): AppMiddleware[];
  /** The one place a middleware is taken on — `App.use` is its late form, a frond's directory its early one. */
  use(middleware: AppMiddleware, entity?: string): void;
}

export function dispatching(
  options: CreateAppOptions,
  log: Logger,
  fronds: Fronds,
  journalOf: () => Journal | undefined,
): Dispatching {
  const inflight = new InFlight();
  const globalMiddlewares: AppMiddleware[] = [];
  const scopedMiddlewares = new Map<string, AppMiddleware[]>();
  const routeRegistry = new RouteRegistry();
  const dispatchLifecycle = new DispatchLifecycle(
    [],
    (error, event) => log.error(
      `[dispatch-observer] ${event.stage} ${event instanceof DoorEvent ? event.request.door : event.call.address.toString()}`,
      error,
    ),
    request.current,
  );

  return {
    inflight,
    routeRegistry,
    dispatchLifecycle,
    dispatcher: new Dispatcher(routeRegistry, inflight, dispatchLifecycle, undefined, journalOf),
    localDispatcher: new Dispatcher(
      routeRegistry,
      inflight,
      dispatchLifecycle,
      new LocalRoutePolicy((surface) => fronds.servedNames(surface)),
      journalOf,
    ),
    getMiddlewares: (address) => [...globalMiddlewares, ...(scopedMiddlewares.get(address) ?? [])],
    use(middleware, entity) {
      if (entity === undefined) {
        globalMiddlewares.push(middleware);

        return;
      }

      scopedMiddlewares.set(entity, [...(scopedMiddlewares.get(entity) ?? []), middleware]);
    },
  };
}

export function serveRpcOn(routeRegistry: RouteRegistry): App['serveRpc'] {
  return (op, answer) => {
    const address = new RouteAddress({ address: RPC_ADDRESS, operation: op });
    if (routeRegistry.find(address)) {
      throw new Error(
        `[claim] The rpc operation '${op}' is already served. If two extensions serve it, keep one of them out of \`extensions:\`.`,
      );
    }

    routeRegistry.register(new OperationRoute('system', address, (call) => answer(call.invocation, call.address.surface)));
  };
}
