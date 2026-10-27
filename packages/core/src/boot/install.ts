/** Putting one frond into the app being built: its scope, what it serves, what it takes. */
import type { Container } from '@fougere/container';
import type { ModuleExtension } from './Extension.js';
import { aroundCalls, standsAroundCalls, theRest } from './calls.js';
import type { Plugged } from '../wire/Plugged.js';
import type { AnswerStep } from '../dispatch/AnswerStep.js';
import type { StateShape } from '../wire/StateShape.js';
import type { ProviderEntry } from '../descriptor/ProviderEntry.js';
import { lowerFirst, type Fields, type SchemaView } from '@fougere/schema';
import type { Logger } from '../builtin/Logger.js';
import { ownLoggers, type OwnLogger } from '../builtin/OwnLoggers.js';
import { basesOf } from '../descriptor/bases.js';
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
import { DoorMiddleware } from '../prefab/DoorMiddleware.js';
import type { DoorAround } from '../entry/door.js';
import { linkOf, ownKeyOf, portBindings, hostPortChains, wrapping, HOST_PORTS } from './ports.js';
import { contractsKeyOf, facadeKeyOf } from '../wire/Facade.js';
import { extendsRepository, subjectOf } from '../prefab/RepositoryOps.js';
import { repositoryKeyOf, seatOf } from '../prefab/Repository.js';
import { storageKeyOf } from '../storage/Storage.js';
import { declares } from '../Source.js';
import { relationChecksOf, refuseUnwritableNull, releasing } from '../module/relation/relations.js';
import type { RowHosts } from '../module/relation/RowHosts.js';
import type { RelationCheck } from '../module/relation/RelationCheck.js';
import { RelationGuard } from '../module/relation/RelationGuard.js';
import { registerCollectors } from '../module/collector/install.js';
import { RouteAddress } from '../wire/RouteAddress.js';
import { servedSurfaces } from '../descriptor/surface.js';
import { OperationRoute } from '../dispatch/OperationRoute.js';
import { facadeOperations } from '../entry/facade.js';
import { decoded } from '../dispatch/decoded.js';

/**
 * What the app is made of while it is still being made. `createApp` builds these, hands
 * them to every frond in turn, and the App it returns is assembled FROM them — so a frond
 * adds to the same container, the same routes and the same tables the next one will read.
 */
export interface Assembly {
  container: Container;
  /** Every extension of the app, in the order they rise — what installs into a frond and steps over an answer. */
  extensions: readonly ModuleExtension[];
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
  /**
   * The references this process reads itself, collected across fronds. Whether one is
   * ANSWERED can only be asked once every frond has registered, which is why the list
   * leaves here rather than being judged where it is built.
   */
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
  /**
   * What runs around each frond, its ancestors' included — filled as fronds install, read by
   * their children. A middleware is not a container key, so inheriting one is a list to carry
   * and not a scope to walk.
   */
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

/**
 * A cross-source reader over the entities this frond NAMED — resolved across the whole app,
 * because such a query joins entities of different fronds by definition. Naming one IS the
 * authorization; that is what the declaration is for.
 */
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

/**
 * The addresses a door middleware bound to a handler stands at — that handler's, in this frond —
 * and a method naming no operation of it refused, since a misspelt op would stand around nothing.
 */
function handledBy(
  frond: FrondDescriptor,
  middleware: FrondDescriptor['middlewares'][number],
  handler: abstract new (...args: never[]) => unknown,
  refused: Diagnostic[],
): ReadonlySet<string> {
  const served = frond.handlers.filter((one) => one.ctor === handler || one.ctor.prototype instanceof handler);
  if (served.length === 0) {
    refused.push({
      severity: 'blocking',
      code: 'door-middleware-handler-elsewhere',
      frond: frond.name,
      subject: middleware.name,
      filePath: middleware.filePath,
      message: `${middleware.name} stands around ${handler.name}, which the frond '${frond.name}' does not serve. `
        + `Move ${middleware.name} into the frond of ${handler.name}.`,
    });

    return new Set();
  }

  const operations = new Set(served.flatMap((one) => [...one.operations.keys()]));
  const prototype = middleware.ctor.prototype as Record<string, unknown>;
  for (const method of Object.getOwnPropertyNames(prototype)) {
    if (method === 'constructor' || typeof prototype[method] !== 'function' || operations.has(method)) continue;
    refused.push({
      severity: 'blocking',
      code: 'door-middleware-unknown-op',
      frond: frond.name,
      subject: `${middleware.name}.${method}`,
      filePath: middleware.filePath,
      message: `${middleware.name}.${method} names no operation of ${handler.name}, which serves ${[...operations].join(', ')}. `
        + 'Name the method after the operation it stands around.',
    });
  }

  return new Set(served.map((one) => one.address));
}

/**
 * ONE instance per frond scope, built at its first call and closed with its frond.
 *
 * Its only consumer is the dispatch, which lives as long as the app, so its lifetime is not a
 * choice. Resolved at the call and never at boot: a dependency may be registered by an
 * extension's `up`, which rises after every frond is installed.
 */
function registerMiddlewares(
  frond: FrondDescriptor,
  scope: Container,
  assembly: Assembly,
  ownLogger: OwnLogger,
  frondLog: Logger,
): void {
  const { use, middlewaresOf, doorMiddlewaresOf, doorMiddlewaresAt } = assembly;
  // Its own frond means every address its handlers answer to — wider than its entities, since
  // a handler without one runs behind it too. A frond that serves nothing has none, which is
  // why what it declares only ever reaches its family.
  const addresses = new Set(frond.handlers.map((h) => h.address));
  // What the parent took on, its own ancestors included — one level up is the whole chain,
  // because the boot installs parents first and each of them left theirs here. The closures
  // resolve in the scope that built them, so an inherited middleware is handed the services of
  // the frond that declared it.
  const inherited = frond.extends ? middlewaresOf.get(frond.extends) ?? [] : [];
  const mine: AppMiddleware[] = [];

  const inheritedAtDoors = frond.extends ? doorMiddlewaresOf.get(frond.extends) ?? [] : [];
  const mineAtDoors: (DoorAround & { at?: ReadonlySet<string> })[] = [];

  if (standsAroundCalls(frond.providers)) mine.push(aroundCalls(scope));
  for (const middleware of frond.middlewares) {
    scope.register(middleware.name, middleware.ctor, { deps: ownLogger(middleware.name, middleware.deps), lifetime: 'singleton' });
    // A door's middleware stands at that door alone, around its requests — not around every call.
    if (middleware.ctor.prototype instanceof DoorMiddleware) {
      const { door, handler } = middleware.ctor as unknown as typeof DoorMiddleware;
      const around = (received: unknown, next: () => Promise<unknown>) => scope.resolve<DoorMiddleware>(middleware.name).around(received, next);
      mineAtDoors.push({ door, around, ...(handler && { at: handledBy(frond, middleware, handler, assembly.refused) }) });
      continue;
    }
    assembly.refused.push({
      severity: 'blocking',
      code: 'middleware-not-a-door',
      frond: frond.name,
      subject: middleware.name,
      filePath: middleware.filePath,
      message: `${middleware.name} is listed as a middleware and stands at no door. What stands around every call is a link: `
        + `{ ctor: ${middleware.name}, deps: ['Dispatcher'], implements: ['Dispatcher'] } among the providers.`,
    });
  }

  // Ancestors first, so they stand OUTSIDE — `getMiddlewares` hands back insertion order.
  for (const around of [...inherited, ...mine]) {
    for (const address of addresses) use(around, address);
  }
  middlewaresOf.set(frond.name, [...inherited, ...mine]);
  // A child inherits what stands around its whole frond; one bound to a handler stays with it.
  doorMiddlewaresOf.set(frond.name, [...inheritedAtDoors, ...mineAtDoors.filter((one) => !one.at)]);
  for (const address of addresses) {
    doorMiddlewaresAt.set(address, [...inheritedAtDoors, ...mineAtDoors.filter((one) => !one.at || one.at.has(address))]);
  }
  if (frond.middlewares.length > 0) {
    assembly.plugged.push({ point: 'middleware', by: 'type', frond: frond.name, answers: frond.middlewares.map((one) => one.name) });
  }

  if (frond.middlewares.length > 0) {
    frondLog.debug(`${frond.middlewares.length} middleware(s): ${frond.middlewares.map((m) => m.name).join(', ')}`);
  }
}

/** What wraps a seam here: what the parent already put in front, then this frond's own. */
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

/**
 * One storage per entity, and the default repository that IS it.
 *
 * The declared chain first, then the guard OUTSIDE it: the guard hands on the value it parsed,
 * so a link reads what the entity says a row is rather than what arrived.
 */
function registerStorages(
  frond: FrondDescriptor,
  assembly: Assembly,
  scope: Container,
  hostPorts: Map<string, ProviderEntry[]>,
  owners: Map<string, string>,
  frondLog: Logger,
): void {
  const { options, refused } = assembly;
  if (!options.storageFactory) return;

  const unenforced: string[] = [];
  const release = releasing(assembly.rowHosts);
  for (const entity of frond.entities) {
    // Held as one value: injected by `valuing` once the schema is checked, never rows.
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

    // Check if the default handler (no surface) declares an output override
    const defaultHandler = frond.handlers.find((h) => h.address === entity.name && !h.surface);
    const outputSchema = defaultHandler?.outputOverride ?? (defaultHandler?.ctor as { __output?: SchemaView } | undefined)?.__output;
    const scoped = outputSchema && outputSchema !== entity.entityClass
      ? baseStorage.output(outputSchema)
      : baseStorage;

    // The declared chain first, then the guard OUTSIDE it: the guard hands on the value
    // it parsed, so a wrapper reads what the entity says a row is rather than what
    // arrived. Same order the client facade has held since `StorageGuard` existed.
    const linked = wrapping('Storage', hostPorts.get('Storage') ?? [], scoped, (dep) => scope.resolve(dep));
    // Storage is a way out like the client surface — see `StorageGuard`.
    refused.push(...refuseUnwritableNull(entity.entityClass, entity.name, entity.filePath));
    const relations = relationChecksOf(entity.entityClass, entity.name, assembly.rowHosts);
    assembly.relations.push(...relations);
    const guarded = new StorageGuard(entity.entityClass.getFields(), entity.name)
      .guard(new RelationGuard(entity.name, relations, release).guard(linked));
    scope.registerValue(key, guarded);

    // The default repository IS the guarded port — it already answers every gesture a
    // declared one forwards, so the two forms have the same shape and a handler reads
    // `repo.list()` either way. The wrapper that used to sit here (`{ storage: guarded }`)
    // existed to make `repo.storage` true in both, back when `.storage` was the way in.
    //
    // Not registered for an OWNED entity: an aggregate's members are reached through it
    // and nowhere else, and the default would be a second facade under a name a handler
    // can spell. Every member is skipped, not just the one the key is named after —
    // that asymmetry was the whole hole.
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
  // The judge refuses a duplicate it can SEE — the row already stored. Two writes arriving
  // together see the same absence, and only the place they land can refuse the second.
  if (unenforced.length > 0) {
    frondLog.warn(
      `${unenforced.join(', ')}: unique, but this source does not enforce it, so two writes at the same moment can both pass.`,
    );
  }
}

/** The sources list where rows live, and none names this entity nor holds the rest. */
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

/**
 * Every provider under its own name, then under the PORT each one extends — so
 * `private payment: Payment` reaches the realization instead of the base it is declared
 * against. The port key is registered AFTER, so it always wins over the base's own.
 *
 * Gives back the seam chains: a seam is bound where its realization is BUILT, not under a
 * container key, so `registerStorages` is the one that puts them in front of something.
 */
function registerProviders(
  frond: FrondDescriptor,
  scope: Container,
  ports: CreateAppOptions['ports'],
  boundPorts: Set<string>,
  refused: Diagnostic[],
  ownLogger: OwnLogger,
  frondLog: Logger,
  plugged: Plugged[],
): Map<string, ProviderEntry[]> {
  // What this frond puts in front of one of the framework's own ports. Its own, like every
  // provider — a link goes where its frond goes, which is what a frond behind `remotes:`
  // takes with it. A link is built by `wrapping`, never by the container: it asks for the seam,
  // and nothing answers that name.
  const hostPorts = hostPortChains(frond.providers, ports, refused);
  const links = new Set([...hostPorts.values()].flat());
  for (const provider of frond.providers) {
    if (links.has(provider)) continue;
    scope.register(nameOf(provider), provider.ctor, { deps: ownLogger(nameOf(provider), provider.deps), ...lifetimeOf(provider.ctor) });
  }
  registerRepositories(frond, scope, refused, ownLogger);
  for (const [seam, links] of hostPorts) {
    boundPorts.add(seam);
    frondLog.debug(`seam ${seam} → ${links.map((one) => one.ctor.name).join(' → ')} → the realization`);
    plugged.push({ point: seam, by: 'type', frond: frond.name, answers: [...links.map(nameOf), 'the realization'] });
  }
  // …and again under the port each one extends, so `private payment: Payment`
  // reaches the realization instead of the base class it is declared against.
  // Registered AFTER the loop above so a port key always wins over the base's
  // own registration — same precedence as a declared repository over its default.
  for (const [port, chain] of portBindings(frond.providers, (n) => scope.has(n), ports, refused)) {
    // A chain a refusal emptied — `ports:` named a class that extends nothing. Already
    // reported, and there is no realization left to put a key in front of.
    if (chain.length === 0) continue;
    // A seam is bound where its realization is BUILT, not under a container key — nothing
    // resolves `Storage`, and `<Entity>Storage` is what a handler asks for.
    if (HOST_PORTS.has(port)) continue;
    // Registered from the INSIDE OUT, each wrapper asking for the one it stands in front
    // of: the container resolves a dep by NAME, so wrapping is a substituted key and
    // needs nothing of the container itself. The outermost answers under the port.
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
    plugged.push({ point: port, by: 'type', frond: frond.name, answers: chain.map(nameOf) });
  }
  if (frond.providers.length > 0) {
    frondLog.debug(`${frond.providers.length} provider(s): ${frond.providers.map(nameOf).join(', ')}`);
  }

  return hostPorts;
}

/**
 * A service built on ONE entity — `class PostQueries extends Repository<Post>` — answers `Repository<Post>`
 * as well as its own name, the way `StripePayment` answers `Payment`: extending is being the thing, and
 * the default repository steps aside. Two refuse, naming both.
 */
function registerRepositories(frond: FrondDescriptor, scope: Container, refused: Diagnostic[], ownLogger: OwnLogger): void {
  const byKey = new Map<string, ProviderEntry[]>();
  for (const provider of frond.providers) {
    const seat = seatOf(provider.ctor);
    if (seat.length !== 1) continue;
    const key = repositoryKeyOf(seat[0]!.name);
    if (key === nameOf(provider)) continue;
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
  }
}

/**
 * A named surface's own storage — the same rows, scoped to what this facade shows.
 *
 * Under the REPOSITORY key, which is what a Crud handler asks for, and under the port's own for
 * a holder that legitimately names it: registering only the latter left a named surface with no
 * facade at all once the façade stopped spelling the storage.
 */
function registerSurfaceStorage(
  entity: EntityEntry,
  handler: HandlerEntry,
  surfaceScope: Container,
  assembly: Assembly,
  frondLog: Logger,
): void {
  const { options } = assembly;
  if (!options.storageFactory) return;

  const baseStorage = options.storageFactory(entity.entityClass, entity.name);
  const outputSchema = handler.outputOverride ?? (handler.ctor as { __output?: SchemaView }).__output;
  const narrowed = outputSchema && outputSchema !== entity.entityClass;
  const scoped = narrowed ? baseStorage.output(outputSchema) : baseStorage;
  // The view is handed over so a filter on a field this facade hides is SAID. The guard holds
  // no logger — a warning is the boot's to voice, as a seed's report is.
  const guarded = new StorageGuard(entity.entityClass.getFields(), entity.name, {
    ...(narrowed ? { view: (outputSchema as { getFields(): Fields }).getFields() } : {}),
    outOfView: (message) => frondLog.warn(message),
  }).guard(new RelationGuard(entity.name, relationChecksOf(entity.entityClass, entity.name, assembly.rowHosts), releasing(assembly.rowHosts)).guard(scoped));

  surfaceScope.registerValue(storageKeyOf(entity.name), guarded);
  surfaceScope.registerValue(repositoryKeyOf(entity.name), guarded);
}

/** What a facade is built out of, for one frond. */
interface Building {
  frond: FrondDescriptor;
  assembly: Assembly;
  /** The frond's own, which a presenter is resolved through whatever audience the facade serves. */
  scope: Container;
  ownLogger: OwnLogger;
  frondLog: Logger;
}

/** The extensions that step over this facade's answers, in the order they rise — and who they are, said. */
function stepsOver(assembly: Assembly, handler: HandlerEntry, frond: FrondDescriptor, scope: Container): AnswerStep[] {
  const answering = assembly.extensions.flatMap((extension) => {
    const steps = extension.steps?.(handler, frond, scope) ?? [];

    return steps.length > 0 ? [{ name: extension.name, steps }] : [];
  });
  if (answering.length > 0) {
    const subject = handler.surface ? `${handler.address}/${handler.surface}` : handler.address;
    assembly.plugged.push({ point: 'answer step', by: 'name', frond: frond.name, subject, answers: answering.map((one) => one.name) });
  }

  return answering.flatMap((one) => one.steps);
}

/** Build the facade of a handler, and register it under the audience it serves. */
function buildFacadeInto(
  { frond, assembly, scope, ownLogger, frondLog }: Building,
  entity: EntityEntry | undefined,
  handler: HandlerEntry,
  targetScope: Container,
  facadeKey: string,
): void {
  const {
    container, routeRegistry, emissions, dispatcher, localDispatcher, effectiveByKey,
    operationModel, getMiddlewares,
  } = assembly;

  if (extendsRepository(handler.ctor) && !entity) {
    // An installed Crud subject may be absent from the local scan.
    frondLog.debug(`${handler.ctor.name} extends Crud() and no scanned entity is named `
      + `'${subjectOf(handler.ctor, handler.address)}' — installed entity, or a missing `
      + `one: no storage will be injected`);
  }

  const facade = new HandlerFacade(handler, targetScope, {
    key: facadeKey,
    frond: frond.name,
    handlers: frond.handlers,
    operations: operationModel.forHandler(handler),
    entities: (name) => assembly.entityByName.get(lowerFirst(name)),
    steps: stepsOver(assembly, handler, frond, scope),
    middlewares: () => getMiddlewares(handler.address),
    state: assembly.state,
    enterOperation: (label, fn) => operation.within(label, fn),
    ownLogger,
  });

  // Emissions use the same contracts and execution path as direct calls, and the terms sit
  // under the same audience — a surface that serves fewer ops describes fewer ops.
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
    // The output SCHEMA, per op: `Crud(Post, { list: PostCard })` names a different one for
    // one operation, so the answer is read back through the view that op actually serves.
    (operation, answer) => decoded(facade.effectiveOperations.get(operation)?.output, answer),
  ));
}

/** Its facades answer elsewhere, but what they LISTEN to is read here, and the bridges route with it. */
function noteRemoteFrond(frond: FrondDescriptor, { operationModel, effectiveByKey, emissions, contractsOf, log }: Assembly): void {
  log.child(frond.name).info('declared remote — not hosted locally');
  for (const handler of frond.handlers) {
    const key = facadeKeyOf(handler.address, handler.surface);
    const operations = operationModel.forHandler(handler);
    effectiveByKey.set(key, operations);
    emissions.note(contractsOf(operations), key);
  }
}

/**
 * Who owns what, and the rule that makes owning mean something — refused before anything is
 * registered, so a bad line is named here rather than by the container.
 */
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

/** A frame is read from the same `deps` every port is: asking for one IS declaring it. */
function registerFramesOf(frond: FrondDescriptor, assembly: Assembly, scope: Container, frondLog: Logger): void {
  const { entityByName, frondOf, options, rowHosts: hosting, refused } = assembly;
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
    rowHosts: hosting,
    log: frondLog,
  }, refused);
}

function sayFacade(building: Building, facadeKey: string, entity: EntityEntry | undefined): void {
  const operations = Object.keys(building.assembly.container.resolve(facadeKey) as object).join(', ');
  building.frondLog.debug(`${facadeKey} [${operations}]`
    + (entity ? '' : ' — no entity of that name: no storage, no projection, no presenter'));
}

/**
 * A facade is about a handler, so this walks HANDLERS — pointing at no entity is legal. The
 * subject is `Crud(Item)`'s when it names one, the handler's own name otherwise, compared by
 * NAME: the scanner and the runtime load one class as two objects.
 */
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

/** A shape that declares no operation answers nothing — said once per entity rather than deduced from a silence. */
function sayUnhandledEntities(building: Building, handlers: readonly HandlerEntry[]): void {
  const handled = new Set(handlers.map((handler) => handler.address));
  for (const entity of building.frond.entities) {
    if (!handled.has(entity.name)) building.frondLog.debug(`${entity.name} — entity only, no handler: exposes nothing`);
  }
}

/**
 * One sub-scope per surface handler, holding the storage its view scopes — under the REPOSITORY
 * key a Crud handler asks for. Pointing at no entity is legal here too: one rule, both surfaces.
 */
function buildSurfaceFacades(building: Building, handlers: readonly HandlerEntry[]): void {
  for (const handler of handlers) {
    const entity = building.frond.entities.find((e) => e.name === handler.address);
    const surfaceScope = building.scope.createScope();
    if (entity) registerSurfaceStorage(entity, handler, surfaceScope, building.assembly, building.frondLog);

    const facadeKey = facadeKeyOf(handler.address, handler.surface);
    buildFacadeInto(building, entity, handler, surfaceScope, facadeKey);
    sayFacade(building, facadeKey, entity);
  }
}

/** A named surface is closed, so what it serves — and what it leaves out — is said at boot, in one line. */
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

  // A child hangs off its parent, so what the parent registered answers here too — parents are installed first.
  const above = frond.extends ? container.resolve<Container>(`frond:${frond.extends}`) : container;
  const scope = above.createScope();
  const frondLog = log.child(frond.name);
  // A child of the APP logger, never of the boot's, whose `boot:` would outlive the boot.
  scope.registerValue('Logger', container.resolve<Logger>('Logger').child(frond.name));

  await registerReads(frond, scope, entityByName, options.sourcesFactory, frondLog);
  const owners = ownershipOf(frond, assembly);

  const ownLogger = ownLoggers(scope, basesOf(frond.providers, (base) => base === 'Logger').has('Logger'));
  // The rest of every call, which a link declaring `implements Partial<Dispatcher>` stands in front of.
  scope.registerValue('Dispatcher', theRest);
  const ports = { ...options.ports, ...frond.ports };
  const declared = registerProviders(frond, scope, ports, assembly.boundPorts, assembly.refused, ownLogger, frondLog, assembly.plugged);
  // An ancestor's links stand OUTSIDE this frond's own; a seam has no container key to inherit through.
  const hostPorts = inheritedHostPorts(frond, assembly.hostPortsOf, declared);
  assembly.hostPortsOf.set(frond.name, hostPorts);
  registerStorages(frond, assembly, scope, hostPorts, owners, frondLog);
  registerFramesOf(frond, assembly, scope, frondLog);

  for (const extension of assembly.extensions) extension.install?.(frond, { scope, container, ownLogger, log: frondLog });
  registerCollectors(frond, scope, ownLogger, frondLog);
  registerMiddlewares(frond, scope, assembly, ownLogger, frondLog);

  const building: Building = { frond, assembly, scope, ownLogger, frondLog };
  const defaultHandlers = frond.handlers.filter((h) => !h.surface);
  const surfaceHandlers = frond.handlers.filter((h) => h.surface);
  buildDefaultFacades(building, defaultHandlers);
  sayUnhandledEntities(building, defaultHandlers);
  buildSurfaceFacades(building, surfaceHandlers);
  sayWhatSurfacesServe(frond, surfaceHandlers, frondLog);

  container.registerValue(`frond:${frond.name}`, scope);
  frondLog.info(`registered — ${frond.entities.length} entities, ${frond.handlers.length} handlers, ${frond.seeds.length} seeds`);
}
