/** Putting one frond into the app being built: its scope, what it serves, what it takes. */
import type { Container } from '@fougere/container';
import { DISPATCH } from './calls.js';
import { doorPorts, reserving } from './doors.js';
import { envKeyOf } from '../module/value/Env.js';
import type { Plugged } from '../wire/Plugged.js';
import type { StateShape } from '../wire/StateShape.js';
import type { ProviderEntry } from '../descriptor/ProviderEntry.js';
import { type SchemaView } from '@fougere/schema';
import type { Logger } from '../builtin/Logger.js';
import { ownLoggers } from '../builtin/OwnLoggers.js';
import { basesOf, realizationsOf } from '../descriptor/bases.js';
import type { Dispatcher } from '../dispatch/Dispatcher.js';
import type { RouteRegistry } from '../dispatch/RouteRegistry.js';
import type { Emissions } from '../module/fact/Emissions.js';
import type { EffectiveOperationModel } from '../EffectiveOperationModel.js';
import type { EffectiveOperationsMap } from '../EffectiveOperationsMap.js';
import type { FrondDescriptor } from '../descriptor/FrondDescriptor.js';
import type { OperationsMap } from '../wire/OperationsMap.js';
import type { AppMiddleware } from '../wire/AppMiddleware.js';
import type { CreateAppOptions } from './CreateAppOptions.js';
import type { Diagnostic } from '../diagnostic.js';
import type { DoorAround } from '../entry/door.js';
import type { RowHosts } from '../module/relation/RowHosts.js';
import type { RelationCheck } from '../module/relation/RelationCheck.js';
import { registerCollectors } from '../module/collector/install.js';
import { exposePresenters, registerPresenters } from '../module/presenter/install.js';
import { chainFields } from '../module/presenter/presented.js';
import { Building, buildDefaultFacades, buildSurfaceFacades, noteRemoteFrond, sayUnhandledEntities, sayWhatSurfacesServe } from './facades.js';
import { inheritedHostPorts, registerMiddlewares, registerProviders } from './providers.js';
import { ownershipOf, registerFramesOf, registerReads, registerStorages } from './storages.js';

/** What the app is made of while it is being made, handed to every frond in turn. */
export interface Assembly {
  container: Container;
  /** What answers each extension point here, written as it is installed — read by `app.extensionPoints()`. */
  plugged: Plugged[];
  routeRegistry: RouteRegistry;
  emissions: Emissions;
  dispatcher: Dispatcher;
  /** A facade under a named surface answers only what that surface serves. */
  localDispatcher: Dispatcher;
  /** Filled per façade key, read back by `operationsFor` and the identity card. */
  effectiveByKey: Map<string, EffectiveOperationsMap>;
  /** Every `ports:` key some frond actually settled — what is left is a typo. */
  boundPorts: Set<string>;
  /** Where a check writes what does not hold — collected across fronds, refused together. */
  refused: Diagnostic[];
  /** The references this process reads itself, judged once every frond installed. */
  relations: RelationCheck[];
  /** Where each entity is hosted — one answer for a frond's storage, its frames and its surfaces. */
  rowHosts: RowHosts;
  /** What the model resolved before the boot performed any side effect. */
  operationModel: EffectiveOperationModel;
  entityByName: Map<string, SchemaView>;
  frondOf: Map<string, string>;
  contractsOf: (operations: EffectiveOperationsMap) => OperationsMap;
  /** Read at call time and never at boot, so a late registration still applies. */
  getMiddlewares: (address: string) => AppMiddleware[];
  /** Take a middleware on — every entity when no entity is named. */
  use: (middleware: AppMiddleware, entity?: string) => void;
  /** What runs around each frond, its ancestors' included. */
  middlewaresOf: Map<string, AppMiddleware[]>;
  /** A frond's door middlewares, its ancestors' first — carried down like `middlewaresOf`. */
  doorMiddlewaresOf: Map<string, DoorAround[]>;
  /** The same, by the address a door answers for — what the cycle asks. */
  doorMiddlewaresAt: Map<string, DoorAround[]>;
  /** What wraps each frond's seams, its ancestors' included — read the same way. */
  hostPortsOf: Map<string, Map<string, ProviderEntry[]>>;
  log: Logger;
  options: CreateAppOptions;
  /** What a call's `state` may hold, read off every extension this process mounts. */
  state: StateShape;
}

export async function installFrond(frond: FrondDescriptor, assembly: Assembly): Promise<void> {
  const { container, entityByName, options, log } = assembly;

  if (options.remotes && frond.name in options.remotes) {
    noteRemoteFrond(frond, assembly);

    return;
  }

  const above = frond.extends ? container.resolve<Container>(`frond:${frond.extends}`) : container;
  const scope = above.createScope();
  const frondLog = log.child(frond.name);
  scope.registerValue('Logger', container.resolve<Logger>('Logger').child(frond.name));

  await registerReads(frond, scope, entityByName, options.sourcesFactory, frondLog);
  const owners = ownershipOf(frond, assembly);

  const ownLogger = ownLoggers(scope, basesOf(frond.providers, (base) => base === 'Logger').has('Logger'));
  const reserve = reserving(frond, scope, assembly.refused);
  for (const step of [DISPATCH, ...doorPorts().map((one) => one.step)]) step.register(frond, scope, reserve);
  const { values } = options;
  for (const { name, entityClass } of frond.entities) {
    if (values?.sourceOf(name) !== undefined) scope.registerValue(envKeyOf(entityClass.name), { read: () => values.read(name, entityClass) });
  }
  const ports = { ...options.ports, ...frond.ports };
  registerCollectors(frond, scope, ownLogger, frondLog);
  registerPresenters(frond, scope, ownLogger, frondLog);
  const declared = registerProviders(frond, scope, ports, assembly.boundPorts, assembly.refused, ownLogger, frondLog, assembly.plugged, realizationsOf(frond));
  const hostPorts = inheritedHostPorts(frond, assembly.hostPortsOf, declared);
  assembly.hostPortsOf.set(frond.name, hostPorts);
  registerStorages(frond, assembly, scope, owners, frondLog);
  registerFramesOf(frond, assembly, scope, frondLog);

  exposePresenters(frond, container, scope);
  const presenterFields = new Map(frond.presenters.map((presenter) => [presenter.entityName, chainFields(frond, presenter, assembly.refused)] as const));
  registerMiddlewares(frond, scope, assembly);

  const building: Building = { frond, assembly, scope, ownLogger, frondLog, presenterFields };
  const defaultHandlers = frond.handlers.filter((h) => !h.surface);
  const surfaceHandlers = frond.handlers.filter((h) => h.surface);
  buildDefaultFacades(building, defaultHandlers);
  sayUnhandledEntities(building, defaultHandlers);
  buildSurfaceFacades(building, surfaceHandlers);
  sayWhatSurfacesServe(frond, surfaceHandlers, frondLog);

  container.registerValue(`frond:${frond.name}`, scope);
  frondLog.info(`registered — ${frond.entities.length} entities, ${frond.handlers.length} handlers, ${frond.seeds.length} seeds`);
}
