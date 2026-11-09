/** Putting one frond into the app being built: its scope, what it serves, what it takes. */
import type { Container } from '@fougere/container';
import { aroundCalls, DISPATCH } from './calls.js';
import { doorPorts, doorStepOf, reserving, standingAtDoors } from './doors.js';
import { envKeyOf } from '../module/value/Env.js';
import type { Plugged } from '../wire/Plugged.js';
import type { AnswerStep } from '../dispatch/AnswerStep.js';
import type { StateShape } from '../wire/StateShape.js';
import type { ProviderEntry } from '../descriptor/ProviderEntry.js';
import { lowerFirst, type Fields, type SchemaView } from '@fougere/schema';
import type { Logger } from '../builtin/Logger.js';
import { ownLoggers, type OwnLogger } from '../builtin/OwnLoggers.js';
import { basesOf, realizationsOf } from '../descriptor/bases.js';
import type { Dispatcher } from '../dispatch/Dispatcher.js';
import type { RouteRegistry } from '../dispatch/RouteRegistry.js';
import type { Emissions } from '../module/fact/Emissions.js';
import type { EffectiveOperationModel } from '../EffectiveOperationModel.js';
import type { EffectiveOperationsMap } from '../EffectiveOperationsMap.js';
import { nameOf } from '../descriptor/FrondDescriptor.js';
import type { EntityEntry } from '../descriptor/EntityEntry.js';
import type { FrondDescriptor } from '../descriptor/FrondDescriptor.js';
import type { HandlerEntry } from '../descriptor/HandlerEntry.js';
import type { OperationsMap } from '../wire/OperationsMap.js';
import type { AppMiddleware } from '../wire/AppMiddleware.js';
import type { CreateAppOptions } from './CreateAppOptions.js';
import { registerFrames } from '../module/frame/together.js';
import { operation } from '../slots.js';
import { lifetimeOf } from '../lifetime.js';
import type { Diagnostic } from '../diagnostic.js';
import { HandlerFacade } from '../dispatch/HandlerFacade.js';
import { targetOf } from '../prefab/prefab.js';
import { ownersOf, sharedNames, storageInUserCode, crudOnOwned } from './ownership.js';
import { refuseValuesAsRows } from '../module/value/refusals.js';
import { refuseArityDrift } from './arity.js';
import { StorageGuard } from '../dispatch/StorageGuard.js';
import type { GuardReport } from '../dispatch/GuardReport.js';
import type { DoorAround } from '../entry/door.js';
import { linkOf, ownKeyOf, portBindings, hostPortChains, wrapping, HOST_PORTS } from './ports.js';
import { contractsKeyOf, facadeKeyOf } from '../wire/Facade.js';
import { extendsRepository, subjectOf } from '../prefab/RepositoryOps.js';
import { repositoryKeyOf, seatOf } from '../prefab/Repository.js';
import { storageKeyOf, type Storage } from '../storage/Storage.js';
import { declares } from '../Source.js';
import { relationChecksOf, refuseUnwritableNull, releasing } from '../module/relation/relations.js';
import type { RowHosts } from '../module/relation/RowHosts.js';
import type { RelationCheck } from '../module/relation/RelationCheck.js';
import { RelationGuard } from '../module/relation/RelationGuard.js';
import { registerCollectors } from '../module/collector/install.js';
import { exposePresenters, registerPresenters } from '../module/presenter/install.js';
import { chainFields, presented } from '../module/presenter/presented.js';
import { RouteAddress } from '../wire/RouteAddress.js';
import { servedSurfaces } from '../descriptor/surface.js';
import { OperationRoute } from '../dispatch/OperationRoute.js';
import { facadeOperations } from '../entry/facade.js';
import { decoded } from '../dispatch/decoded.js';

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

async function registerReads(
  frond: FrondDescriptor,
  scope: Container,
  entityByName: Map<string, unknown>,
  sourcesFactory: CreateAppOptions['sourcesFactory'],
  frondLog: Logger,
): Promise<void> {
  if (!frond.reads?.length) return;

  if (!sourcesFactory) {
    frondLog.warn(
      `[reads] ${frond.reads.join(', ')}: in frond.config.ts, but nothing here can read across sources, `
      + 'so a handler asking for Reads fails at its first call. Install @fougere/adapter-duckdb, or remove reads:.',
    );

    return;
  }

  const named = frond.reads
    .map((name) => entityByName.get(lowerFirst(name)))
    .filter((entity): entity is NonNullable<typeof entity> => entity !== undefined);
  if (named.length !== frond.reads.length) {
    const missing = frond.reads.filter((name) => !entityByName.has(lowerFirst(name)));
    frondLog.warn(
      `[reads] ${missing.join(', ')}: in frond.config.ts, but no such entity exists in this app. Check the spelling.`,
    );
  }

  scope.registerValue('Reads', await sourcesFactory(named, frond.name));
  frondLog.debug(`cross-source reader over ${named.length} entit(ies)`);
}


function registerMiddlewares(
  frond: FrondDescriptor,
  scope: Container,
  assembly: Assembly,
  ownLogger: OwnLogger,
  frondLog: Logger,
): void {
  const { use, middlewaresOf, doorMiddlewaresOf, doorMiddlewaresAt } = assembly;
  const addresses = new Set(frond.handlers.map((h) => h.address));
  const inherited = frond.extends ? middlewaresOf.get(frond.extends) ?? [] : [];
  const mine: AppMiddleware[] = [];

  const inheritedAtDoors = frond.extends ? doorMiddlewaresOf.get(frond.extends) ?? [] : [];
  const mineAtDoors: (DoorAround & { at?: ReadonlySet<string> })[] = [];

  const calls = DISPATCH.standing(frond, assembly.plugged);
  mine.push(...calls.filter((one) => !one.at).map(({ key }) => aroundCalls(scope, key)));
  mineAtDoors.push(...standingAtDoors(frond, scope, assembly.plugged, assembly.refused));

  for (const around of [...inherited, ...mine]) {
    for (const address of addresses) use(around, address);
  }
  for (const { key, at } of calls) {
    if (!at) continue;
    const around = aroundCalls(scope, key);
    for (const address of at) use(around, address);
  }
  middlewaresOf.set(frond.name, [...inherited, ...mine]);
  doorMiddlewaresOf.set(frond.name, [...inheritedAtDoors, ...mineAtDoors.filter((one) => !one.at)]);
  for (const address of addresses) {
    doorMiddlewaresAt.set(address, [...inheritedAtDoors, ...mineAtDoors.filter((one) => !one.at || one.at.has(address))]);
  }
}

function inheritedHostPorts(
  frond: FrondDescriptor,
  hostPortsOf: Map<string, Map<string, ProviderEntry[]>>,
  declared: Map<string, ProviderEntry[]>,
): Map<string, ProviderEntry[]> {
  const above = frond.extends ? hostPortsOf.get(frond.extends) : undefined;
  if (!above) return declared;

  const all = new Map(declared);
  for (const [seam, links] of above) all.set(seam, [...links, ...(declared.get(seam) ?? [])]);

  return all;
}

function rowsOf(
  assembly: Assembly,
  owner: string,
  scope: Container,
  entity: { name: string; schema: SchemaView },
  realization: Storage,
  report?: GuardReport,
): Storage {
  const links = assembly.hostPortsOf.get(owner)?.get('Storage') ?? [];
  const linked = wrapping('Storage', links, realization, (dep) => scope.resolve(dep));
  const related = relationGuardOf(assembly, entity).guard(linked);

  return new StorageGuard(entity.schema.getFields(), entity.name, report).guard(related);
}

const relationGuards = new WeakMap<Assembly, Map<SchemaView, RelationGuard>>();

function relationGuardOf(assembly: Assembly, entity: { name: string; schema: SchemaView }): RelationGuard {
  const held = relationGuards.get(assembly) ?? new Map<SchemaView, RelationGuard>();
  relationGuards.set(assembly, held);
  const { rowHosts } = assembly;
  const guard = held.get(entity.schema)
    ?? new RelationGuard(entity.name, relationChecksOf(entity.schema, entity.name, rowHosts), releasing(rowHosts));
  held.set(entity.schema, guard);

  return guard;
}

function registerStorages(
  frond: FrondDescriptor,
  assembly: Assembly,
  scope: Container,
  owners: Map<string, string>,
  frondLog: Logger,
): void {
  const { options, refused } = assembly;
  if (!options.storageFactory) return;

  const unenforced: string[] = [];
  for (const entity of frond.entities) {
    if (options.values?.sourceOf(entity.name) !== undefined) continue;
    const key = storageKeyOf(entity.name);
    const placed = options.sourceOf?.(entity.name);
    if (options.sourceOf && placed === undefined) {
      refused.push(sourceMissing(frond, entity));
      continue;
    }
    const source = placed ?? 'default';
    if (declares(entity.entityClass, 'unique') && options.enforces?.(source, 'unique') === false) {
      unenforced.push(`${entity.name} in '${source}'`);
    }
    const baseStorage = options.storageFactory(entity.entityClass, entity.name);

    const defaultHandler = frond.handlers.find((h) => h.address === entity.name && !h.surface);
    const outputSchema = defaultHandler?.outputOverride ?? (defaultHandler?.ctor as { __output?: SchemaView } | undefined)?.__output;
    const scoped = outputSchema && outputSchema !== entity.entityClass
      ? baseStorage.output(outputSchema)
      : baseStorage;

    refused.push(...refuseUnwritableNull(entity.entityClass, entity.name, entity.filePath));
    assembly.relations.push(...relationChecksOf(entity.entityClass, entity.name, assembly.rowHosts));
    const guarded = rowsOf(assembly, frond.name, scope, { name: entity.name, schema: entity.entityClass }, scoped);
    scope.registerValue(key, guarded);

    const repoKey = repositoryKeyOf(entity.name);
    const owner = owners.get(entity.name);
    if (owner) {
      frondLog.debug(`${entity.name} — owned by ${owner}, no default repository`);
    } else if (!scope.has(repoKey)) {
      scope.registerValue(repoKey, guarded);
    }
  }
  if (frond.entities.length > 0) {
    frondLog.debug(`${frond.entities.length} entity storage(s): ${frond.entities.map((e) => e.name).join(', ')}`);
  }
  if (unenforced.length > 0) {
    frondLog.warn(
      `${unenforced.join(', ')}: unique, but this source does not enforce it, so two writes at the same moment can both pass.`,
    );
  }
}

function sourceMissing(frond: FrondDescriptor, entity: FrondDescriptor['entities'][number]): Diagnostic {
  return {
    severity: 'blocking',
    code: 'source-missing',
    frond: frond.name,
    subject: entity.name,
    filePath: entity.filePath,
    message: `${entity.name} lives in no source: every entry of sources: lists its rows, so none holds the rest. `
      + `Add '${entity.name}' to the rows: of one, or give one source no rows: list.`,
  };
}

function registerProviders(
  frond: FrondDescriptor,
  scope: Container,
  ports: CreateAppOptions['ports'],
  boundPorts: Set<string>,
  refused: Diagnostic[],
  ownLogger: OwnLogger,
  frondLog: Logger,
  plugged: Plugged[],
  realizations: readonly ProviderEntry[],
): Map<string, ProviderEntry[]> {
  const hostPorts = hostPortChains(frond.providers, ports, refused);
  const links = new Set([...hostPorts.values()].flat());
  const registered = new Set<string>();
  for (const provider of frond.providers) {
    if (links.has(provider) || registered.has(nameOf(provider))) continue;
    registered.add(nameOf(provider));
    scope.register(nameOf(provider), provider.ctor, { deps: ownLogger(nameOf(provider), provider.deps), ...lifetimeOf(provider.ctor) });
  }
  registerRepositories(frond, scope, refused, ownLogger, plugged);
  for (const [seam, links] of hostPorts) {
    boundPorts.add(seam);
    frondLog.debug(`seam ${seam} → ${links.map((one) => one.ctor.name).join(' → ')} → the realization`);
    plugged.push({ point: seam, by: 'type', frond: frond.name, answers: [...links.map(nameOf), 'the realization'] });
  }
  for (const [port, chain] of portBindings([...frond.providers, ...realizations], (n) => scope.has(n), ports, refused)) {
    if (chain.length === 0) continue;
    if (HOST_PORTS.has(port)) continue;
    const realization = chain.at(-1)!;
    const wraps = realization.deps.includes(port);
    const wrappers = wraps ? chain : chain.slice(0, -1);
    let inner = wraps ? ownKeyOf(port) : nameOf(realization);
    if (wraps) scope.registerValue(inner, scope.resolve(port));
    for (const wrapper of wrappers.slice(1).reverse()) {
      const deps = ownLogger(nameOf(wrapper), wrapper.deps).map((dep) => (dep === port ? inner : dep));
      inner = nameOf(wrapper);
      scope.replace(inner, linkOf(wrapper, port), { deps, ...lifetimeOf(wrapper.ctor) });
    }
    const outermost = chain[0]!;
    const outermostOptions = {
      deps: ownLogger(nameOf(outermost), outermost.deps).map((dep) => (dep === port ? inner : dep)),
      ...lifetimeOf(outermost.ctor),
    };
    const Outermost = linkOf(outermost, port);
    if (wrappers.length > 0) scope.replace(nameOf(outermost), Outermost, outermostOptions);
    if (scope.has(port)) scope.replace(port, Outermost, outermostOptions);
    else scope.register(port, Outermost, outermostOptions);
    boundPorts.add(port);
    frondLog.debug(`port ${port} → ${chain.map((one) => one.ctor.name).join(' → ')}`);
    plugged.push({ point: port, by: 'type', frond: frond.name, answers: [...chain.map(nameOf), ...(wraps ? [innermostOf(port)] : [])] });
  }
  if (frond.providers.length > 0) {
    frondLog.debug(`${frond.providers.length} provider(s): ${frond.providers.map(nameOf).join(', ')}`);
  }

  return hostPorts;
}

function innermostOf(port: string): string {
  const step = DISPATCH.covers(port) ? DISPATCH : doorStepOf(port);
  if (step) return step.innermost;
  if (port.startsWith('Env<')) return 'the source';

  return `the ${port} the frond had`;
}

function registerRepositories(frond: FrondDescriptor, scope: Container, refused: Diagnostic[], ownLogger: OwnLogger, plugged: Plugged[]): void {
  const byKey = new Map<string, ProviderEntry[]>();
  for (const provider of frond.providers) {
    const seat = seatOf(provider.ctor);
    if (seat.length !== 1) continue;
    const key = repositoryKeyOf(seat[0]!.name);
    byKey.set(key, [...(byKey.get(key) ?? []), provider]);
  }
  for (const [key, providers] of byKey) {
    if (providers.length > 1) {
      refused.push({
        severity: 'blocking',
        code: 'repository-twice',
        frond: frond.name,
        subject: key,
        filePath: providers[1]!.filePath,
        message: `${providers.map(nameOf).join(' and ')} both extend the repository ${key} answers, and one key has one `
          + 'answer. Keep one; the other may ask for it.',
      });
      continue;
    }
    const provider = providers[0]!;
    scope.register(key, provider.ctor, { deps: ownLogger(nameOf(provider), provider.deps), ...lifetimeOf(provider.ctor) });
    plugged.push({ point: `Repository<${seatOf(provider.ctor)[0]!.name}>`, by: 'type', frond: frond.name, answers: [nameOf(provider)] });
  }
}

function registerSurfaceStorage(
  entity: EntityEntry,
  handler: HandlerEntry,
  surfaceScope: Container,
  building: Building,
): void {
  const { assembly, frond, frondLog } = building;
  const { options } = assembly;
  if (!options.storageFactory) return;

  const baseStorage = options.storageFactory(entity.entityClass, entity.name);
  const outputSchema = handler.outputOverride ?? (handler.ctor as { __output?: SchemaView }).__output;
  const narrowed = outputSchema && outputSchema !== entity.entityClass;
  const scoped = narrowed ? baseStorage.output(outputSchema) : baseStorage;
  const guarded = rowsOf(assembly, frond.name, surfaceScope, { name: entity.name, schema: entity.entityClass }, scoped, {
    ...(narrowed ? { view: (outputSchema as { getFields(): Fields }).getFields() } : {}),
    outOfView: (message) => frondLog.warn(message),
  });

  surfaceScope.registerValue(storageKeyOf(entity.name), guarded);
  surfaceScope.registerValue(repositoryKeyOf(entity.name), guarded);
}

interface Building {
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
  const { frond, assembly, scope, ownLogger, frondLog } = building;
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

function noteRemoteFrond(frond: FrondDescriptor, { operationModel, effectiveByKey, emissions, contractsOf, log, options, plugged }: Assembly): void {
  log.child(frond.name).info('declared remote — not hosted locally');
  plugged.push({ point: 'served at', by: 'name', frond: frond.name, answers: [options.remotes?.[frond.name] ?? 'another process'] });
  for (const handler of frond.handlers) {
    const key = facadeKeyOf(handler.address, handler.surface);
    const operations = operationModel.forHandler(handler);
    effectiveByKey.set(key, operations);
    emissions.note(contractsOf(operations), key);
  }
}

function ownershipOf(frond: FrondDescriptor, assembly: Assembly): Map<string, string> {
  const { entityByName, refused } = assembly;
  sharedNames(frond, refused);
  refuseArityDrift(frond, refused);
  const owners = ownersOf(frond.providers, frond.name, refused);
  const valued = (entity: string) => assembly.options.values?.sourceOf(entity) !== undefined;
  storageInUserCode(frond, owners, (entity) => entityByName.has(entity) && !valued(entity), refused);
  crudOnOwned(frond, owners, refused);
  refuseValuesAsRows(frond, valued, new Set(entityByName.keys()), refused);

  return owners;
}

function registerFramesOf(frond: FrondDescriptor, assembly: Assembly, scope: Container, frondLog: Logger): void {
  const { container, entityByName, frondOf, options, refused } = assembly;
  const wanted = [...frond.handlers, ...frond.providers, ...frond.presenters, ...frond.collectors]
    .flatMap((declared) => declared.deps.map((key) => ({ key, filePath: declared.filePath })));

  registerFrames(scope, wanted, frond.providers, {
    entityByName,
    frondOf,
    hostedHere: (name) => !(options.remotes && name in options.remotes),
    storageFactory: options.storageFactory,
    sourceOf: options.sourceOf,
    transacts: options.transacts,
    transacted: options.transacted,
    rowsOf: (entity, realization) => {
      const owner = frondOf.get(entity.name) ?? frond.name;

      return rowsOf(assembly, owner, container.resolve<Container>(`frond:${owner}`), entity, realization);
    },
    log: frondLog,
  }, refused);
}

function sayFacade(building: Building, facadeKey: string, entity: EntityEntry | undefined): void {
  const operations = Object.keys(building.assembly.container.resolve(facadeKey) as object).join(', ');
  building.frondLog.debug(`${facadeKey} [${operations}]`
    + (entity ? '' : ' — no entity of that name: no storage, no projection, no presenter'));
}

function buildDefaultFacades(building: Building, handlers: readonly HandlerEntry[]): void {
  for (const handler of handlers) {
    const crudTarget = targetOf(handler.ctor);
    const subject = crudTarget?.name ? lowerFirst(crudTarget.name) : handler.address;
    const entity = building.frond.entities.find((e) => e.name === subject);
    const facadeKey = facadeKeyOf(handler.address);
    buildFacadeInto(building, entity, handler, building.scope, facadeKey);
    sayFacade(building, facadeKey, entity);
  }
}

function sayUnhandledEntities(building: Building, handlers: readonly HandlerEntry[]): void {
  const handled = new Set(handlers.map((handler) => handler.address));
  for (const entity of building.frond.entities) {
    if (!handled.has(entity.name)) building.frondLog.debug(`${entity.name} — entity only, no handler: exposes nothing`);
  }
}

function buildSurfaceFacades(building: Building, handlers: readonly HandlerEntry[]): void {
  for (const handler of handlers) {
    const entity = building.frond.entities.find((e) => e.name === handler.address);
    const surfaceScope = building.scope.createScope();
    if (entity) registerSurfaceStorage(entity, handler, surfaceScope, building);

    const facadeKey = facadeKeyOf(handler.address, handler.surface);
    buildFacadeInto(building, entity, handler, surfaceScope, facadeKey);
    sayFacade(building, facadeKey, entity);
  }
}

function sayWhatSurfacesServe(frond: FrondDescriptor, handlers: readonly HandlerEntry[], frondLog: Logger): void {
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
  registerMiddlewares(frond, scope, assembly, ownLogger, frondLog);

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
