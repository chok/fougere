import type { Container } from '@fougere/container';
import type { AnswerStep } from '../dispatch/AnswerStep.js';
import { lowerFirst } from '@fougere/schema';
import type { Logger } from '../builtin/Logger.js';
import { type OwnLogger } from '../builtin/OwnLoggers.js';
import type { EntityEntry } from '../descriptor/EntityEntry.js';
import type { FrondDescriptor } from '../descriptor/FrondDescriptor.js';
import type { HandlerEntry } from '../descriptor/HandlerEntry.js';
import { operation } from '../slots.js';
import { HandlerFacade } from '../dispatch/HandlerFacade.js';
import { targetOf } from '../prefab/prefab.js';
import { contractsKeyOf, facadeKeyOf } from '../wire/Facade.js';
import { extendsRepository, subjectOf } from '../prefab/RepositoryOps.js';
import { presented } from '../module/presenter/presented.js';
import { RouteAddress } from '../wire/RouteAddress.js';
import { servedSurfaces } from '../descriptor/surface.js';
import { OperationRoute } from '../dispatch/OperationRoute.js';
import { facadeOperations } from '../entry/facade.js';
import { decoded } from '../dispatch/decoded.js';
import type { Assembly } from './install.js';
import { registerSurfaceStorage } from './storages.js';

export interface Building {
  frond: FrondDescriptor;
  assembly: Assembly;
  /** The frond's own, which a presenter is resolved through whatever audience the facade serves. */
  scope: Container;
  ownLogger: OwnLogger;
  frondLog: Logger;
  /** What each `Present<Post>` chain computes, by the entity it sits on. */
  presenterFields: ReadonlyMap<string, string[]>;
}

function stepsOver({ frond, scope, presenterFields }: Building, handler: HandlerEntry): AnswerStep[] {
  const presenter = frond.presenters.find((one) => one.entityName === handler.address);

  return presented(presenter, presenter ? presenterFields.get(presenter.entityName) ?? presenter.fields : [], scope);
}

function buildFacadeInto(
  building: Building,
  entity: EntityEntry | undefined,
  handler: HandlerEntry,
  targetScope: Container,
  facadeKey: string,
): void {
  const { frond, assembly, ownLogger, frondLog } = building;
  const {
    container, routeRegistry, emissions, dispatcher, localDispatcher, effectiveByKey,
    operationModel, getMiddlewares,
  } = assembly;

  if (extendsRepository(handler.ctor) && !entity) {
    frondLog.debug(`${handler.ctor.name} extends Crud() and no scanned entity is named `
      + `'${subjectOf(handler.ctor, handler.address)}' — installed entity, or a missing `
      + `one: no storage will be injected`);
  }

  const facade = new HandlerFacade(handler, targetScope, {
    key: facadeKey,
    frond: frond.name,
    handlers: frond.handlers,
    operations: operationModel.forHandler(handler),
    entities: (name) => frond.entities.find((entity) => entity.name === lowerFirst(name))?.entityClass ?? assembly.entityByName.get(lowerFirst(name)),
    steps: stepsOver(building, handler),
    middlewares: () => getMiddlewares(handler.address),
    state: assembly.state,
    enterOperation: (label, fn) => operation.within(label, fn),
    ownLogger,
  });

  emissions.note(facade.contracts, facadeKey);
  container.registerValue(contractsKeyOf(handler.address, handler.surface), facade.contracts);
  effectiveByKey.set(facadeKey, facade.effectiveOperations);

  for (const operation of facade.contracts.keys()) {
    for (const surface of servedSurfaces(frond, handler)) {
      routeRegistry.register(new OperationRoute(
        'local',
        new RouteAddress({
          address: handler.address,
          operation,
          ...(surface !== undefined ? { surface } : {}),
        }),
        (call) => facade.execute(operation, call.invocation),
      ));
    }
  }

  container.registerValue(facadeKey, facadeOperations(
    handler.surface ? localDispatcher : dispatcher,
    handler.address,
    routeRegistry.operationNames(handler.address, handler.surface),
    handler.surface,
    (operation, answer) => decoded(facade.effectiveOperations.get(operation)?.output, answer),
  ));
}

export function noteRemoteFrond(frond: FrondDescriptor, { operationModel, effectiveByKey, emissions, contractsOf, log, options, plugged }: Assembly): void {
  log.child(frond.name).info('declared remote — not hosted locally');
  plugged.push({ point: 'served at', by: 'name', frond: frond.name, answers: [options.remotes?.[frond.name] ?? 'another process'] });
  for (const handler of frond.handlers) {
    const key = facadeKeyOf(handler.address, handler.surface);
    const operations = operationModel.forHandler(handler);
    effectiveByKey.set(key, operations);
    emissions.note(contractsOf(operations), key);
  }
}

function sayFacade(building: Building, facadeKey: string, entity: EntityEntry | undefined): void {
  const operations = Object.keys(building.assembly.container.resolve(facadeKey) as object).join(', ');
  building.frondLog.debug(`${facadeKey} [${operations}]`
    + (entity ? '' : ' — no entity of that name: no storage, no projection, no presenter'));
}

export function buildDefaultFacades(building: Building, handlers: readonly HandlerEntry[]): void {
  for (const handler of handlers) {
    const crudTarget = targetOf(handler.ctor);
    const subject = crudTarget?.name ? lowerFirst(crudTarget.name) : handler.address;
    const entity = building.frond.entities.find((e) => e.name === subject);
    const facadeKey = facadeKeyOf(handler.address);
    buildFacadeInto(building, entity, handler, building.scope, facadeKey);
    sayFacade(building, facadeKey, entity);
  }
}

export function sayUnhandledEntities(building: Building, handlers: readonly HandlerEntry[]): void {
  const handled = new Set(handlers.map((handler) => handler.address));
  for (const entity of building.frond.entities) {
    if (!handled.has(entity.name)) building.frondLog.debug(`${entity.name} — entity only, no handler: exposes nothing`);
  }
}

export function buildSurfaceFacades(building: Building, handlers: readonly HandlerEntry[]): void {
  for (const handler of handlers) {
    const entity = building.frond.entities.find((e) => e.name === handler.address);
    const surfaceScope = building.scope.createScope();
    if (entity) registerSurfaceStorage(entity, handler, surfaceScope, building);

    const facadeKey = facadeKeyOf(handler.address, handler.surface);
    buildFacadeInto(building, entity, handler, surfaceScope, facadeKey);
    sayFacade(building, facadeKey, entity);
  }
}

export function sayWhatSurfacesServe(frond: FrondDescriptor, handlers: readonly HandlerEntry[], frondLog: Logger): void {
  const surfaceNames = [...new Set(handlers.map((h) => h.surface as string))].sort();
  for (const surfaceName of surfaceNames) {
    const served = handlers.filter((h) => h.surface === surfaceName).map((h) => h.address).sort();
    const absent = frond.entities.map((e) => e.name).filter((n) => !served.includes(n));
    frondLog.info(
      `surface '${surfaceName}' — ${served.length} entit${served.length === 1 ? 'y' : 'ies'}: ${served.join(', ')}` +
      (absent.length > 0 ? ` (not served: ${absent.join(', ')})` : ''),
    );
  }
}
