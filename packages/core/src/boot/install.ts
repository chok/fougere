/** Putting one frond into the app being built: its scope, what it serves, what it takes. */
import type { Container } from '@fougere/container';
import type { ProviderEntry } from '../descriptor/ProviderEntry.js';
import type { PresenterEntry } from '../descriptor/PresenterEntry.js';
import { lowerFirst, type Fields, type SchemaView } from '@fougere/schema';
import type { Logger } from '../builtin/Logger.js';
import type { Dispatcher } from '../dispatch/Dispatcher.js';
import type { RouteRegistry } from '../dispatch/RouteRegistry.js';
import type { Emissions } from './Emissions.js';
import type { EffectiveOperationModel } from '../EffectiveOperationModel.js';
import type { EffectiveOperationsMap } from '../EffectiveOperationsMap.js';
import { nameOf } from '../descriptor/FrondDescriptor.js';
import type { EntityEntry } from '../descriptor/EntityEntry.js';
import type { FrondDescriptor } from '../descriptor/FrondDescriptor.js';
import type { HandlerEntry } from '../descriptor/HandlerEntry.js';
import type { OperationsMap } from '../wire/OperationsMap.js';
import type { AppMiddleware } from '../wire/AppMiddleware.js';
import type { CreateAppOptions } from './CreateAppOptions.js';
import { registerFrames } from './together.js';
import type { Diagnostic } from '../diagnostic.js';
import { HandlerFacade } from '../dispatch/HandlerFacade.js';
import { targetOf } from '../prefab/prefab.js';
import { ownersOf, sharedNames, storageInUserCode, crudOnOwned } from './ownership.js';
import { StorageGuard } from '../dispatch/StorageGuard.js';
import { portBindings, seamChains, wrapping, SEAMS } from './ports.js';
import { contractsKeyOf, facadeKeyOf } from '../wire/Facade.js';
import { inheritsCrud, subjectOf } from '../prefab/CrudConstructor.js';
import { repositoryKeyOf } from '../prefab/RepositoryConstructor.js';
import { storageKeyOf } from '../storage/Storage.js';
import { declares } from '../Source.js';
import { heldBy, refuseUnwritableNull, releasing } from './relations.js';
import type { Hosting } from './Hosting.js';
import type { RelationCheck } from '../dispatch/RelationCheck.js';
import { presenterKeyOf } from '../prefab/presenter.js';
import { collectorKeyOf } from '../prefab/collector.js';
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
  hosting: Hosting;
  /** What the model resolved before the boot performed any side effect. */
  operationModel: EffectiveOperationModel;
  entityByName: Map<string, SchemaView>;
  frondOf: Map<string, string>;
  contractsOf: (operations: EffectiveOperationsMap) => OperationsMap;
  /** Read at call time and never at boot, so a late registration still applies. */
  getMiddlewares: (entity: string) => AppMiddleware[];
  /** Take a middleware on — every entity when no entity is named. */
  use: (middleware: AppMiddleware, entity?: string) => void;
  /**
   * What runs around each frond, its ancestors' included — filled as fronds install, read by
   * their children. A middleware is not a container key, so inheriting one is a list to carry
   * and not a scope to walk.
   */
  middlewaresOf: Map<string, AppMiddleware[]>;
  /** What wraps each frond's seams, its ancestors' included — read the same way. */
  seamsOf: Map<string, Map<string, ProviderEntry[]>>;
  log: Logger;
  options: CreateAppOptions;
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
      `[reads] ${frond.reads.join(', ')} — declared in frond.config.ts, but this boot passes no `
      + '`sourcesFactory`, so no reader is registered and a handler asking for `Reads` will fail '
      + 'at its first call. Pass one (`@fougere/adapter-duckdb`), or drop the clause.',
    );

    return;
  }

  const named = frond.reads
    .map((name) => entityByName.get(lowerFirst(name)))
    .filter((entity): entity is NonNullable<typeof entity> => entity !== undefined);
  if (named.length !== frond.reads.length) {
    const missing = frond.reads.filter((name) => !entityByName.has(lowerFirst(name)));
    frondLog.warn(
      `[reads] ${missing.join(', ')} — named in frond.config.ts but scanned nowhere in this app, `
      + 'so a query naming one would find no table. Check the spelling, or the entity file.',
    );
  }

  scope.registerValue('Reads', await sourcesFactory(named, frond.name));
  frondLog.debug(`cross-source reader over ${named.length} entit(ies)`);
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
  frondLog: Logger,
): void {
  const { use, middlewaresOf } = assembly;
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

  for (const middleware of frond.middlewares) {
    scope.register(middleware.name, middleware.ctor, { deps: middleware.deps, lifetime: 'singleton' });
    mine.push((context, next) =>
      scope.resolve<{ around: AppMiddleware }>(middleware.name).around(context, next));
  }

  // Ancestors first, so they stand OUTSIDE — `getMiddlewares` hands back insertion order.
  for (const around of [...inherited, ...mine]) {
    for (const address of addresses) use(around, address);
  }
  middlewaresOf.set(frond.name, [...inherited, ...mine]);

  if (frond.middlewares.length > 0) {
    frondLog.debug(`${frond.middlewares.length} middleware(s): ${frond.middlewares.map((m) => m.name).join(', ')}`);
  }
}

/** What wraps a seam here: what the parent already put in front, then this frond's own. */
function inheritedSeams(
  frond: FrondDescriptor,
  seamsOf: Map<string, Map<string, ProviderEntry[]>>,
  declared: Map<string, ProviderEntry[]>,
): Map<string, ProviderEntry[]> {
  const above = frond.extends ? seamsOf.get(frond.extends) : undefined;
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
  seams: Map<string, ProviderEntry[]>,
  owners: Map<string, string>,
  frondLog: Logger,
): void {
  const { options, refused } = assembly;
  if (!options.storageFactory) return;

  const unenforced: string[] = [];
  const release = releasing(assembly.hosting);
  for (const entity of frond.entities) {
    const key = storageKeyOf(entity.name);
    const source = options.sourceOf?.(entity.name) ?? 'db';
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
    const linked = wrapping('Storage', seams.get('Storage') ?? [], scoped, (dep) => scope.resolve(dep));
    // Storage is a way out like the client surface — see `StorageGuard`.
    refused.push(...refuseUnwritableNull(entity.entityClass, entity.name, entity.filePath));
    const relations = heldBy(entity.entityClass, entity.name, assembly.hosting);
    assembly.relations.push(...relations);
    const guarded = new StorageGuard(
      entity.entityClass.getFields(), entity.name, {}, relations, release,
    ).guard(linked);
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
      `unique declared, and the source does not enforce it: ${unenforced.join(', ')} — `
      + 'two concurrent writes can both pass',
    );
  }
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
  frondLog: Logger,
): Map<string, ProviderEntry[]> {
  for (const provider of frond.providers) {
    // `kept` is `implements AsyncDisposable` — one per frond scope, closed when it closes.
    // Without it a provider is built per consumer and closed by nobody, which is what a
    // service holding nothing wants.
    scope.register(nameOf(provider), provider.ctor, {
      deps: provider.deps,
      ...(provider.kept ? { lifetime: 'singleton' as const } : {}),
    });
  }
  // What this frond puts in front of one of the framework's own ports. Its own, like every
  // provider — a link goes where its frond goes, which is what a frond behind `remotes:`
  // takes with it.
  const seams = seamChains(frond.providers, ports, refused);
  for (const [seam, links] of seams) {
    boundPorts.add(seam);
    frondLog.debug(`seam ${seam} → ${links.map((one) => one.ctor.name).join(' → ')} → the realization`);
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
    if (SEAMS.has(port)) continue;
    // Registered from the INSIDE OUT, each wrapper asking for the one it stands in front
    // of: the container resolves a dep by NAME, so wrapping is a substituted key and
    // needs nothing of the container itself. The outermost answers under the port.
    let inner = nameOf(chain.at(-1)!);
    for (const wrapper of [...chain.slice(0, -1)].reverse()) {
      const deps = wrapper.deps.map((dep) => (dep === port ? inner : dep));
      inner = nameOf(wrapper);
      scope.register(inner, wrapper.ctor, { deps });
    }
    const outermost = chain[0]!;
    scope.register(port, outermost.ctor, {
      deps: outermost.deps.map((dep) => (dep === port ? nameOf(chain[1]!) : dep)),
    });
    boundPorts.add(port);
    frondLog.debug(`port ${port} → ${chain.map((one) => one.ctor.name).join(' → ')}`);
  }
  if (frond.providers.length > 0) {
    frondLog.debug(`${frond.providers.length} provider(s): ${frond.providers.map(nameOf).join(', ')}`);
  }

  return seams;
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
  }, heldBy(entity.entityClass, entity.name, assembly.hosting), releasing(assembly.hosting)).guard(scoped);

  surfaceScope.registerValue(storageKeyOf(entity.name), guarded);
  surfaceScope.registerValue(repositoryKeyOf(entity.name), guarded);
}

/**
 * A presenter is about an entity — computed fields sit on a shape — so this walks entities.
 * Exposed lazily: the bridge resolves the instance on first access.
 */
function exposePresenters(
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

/** What a facade is built out of, for one frond. */
interface Building {
  frond: FrondDescriptor;
  assembly: Assembly;
  /** The frond's own, which a presenter is resolved through whatever audience the facade serves. */
  scope: Container;
  collectorTypeNames: Set<string>;
  presenterMap: Map<string, PresenterEntry>;
  frondLog: Logger;
}

/** Build the facade of a handler, and register it under the audience it serves. */
function buildFacadeInto(
  { frond, assembly, scope, collectorTypeNames, presenterMap, frondLog }: Building,
  entity: EntityEntry | undefined,
  handler: HandlerEntry,
  targetScope: Container,
  facadeKey: string,
): void {
  const {
    container, routeRegistry, emissions, dispatcher, localDispatcher, effectiveByKey,
    operationModel, getMiddlewares,
  } = assembly;

  if (inheritsCrud(handler.ctor) && !entity) {
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
    collectors: collectorTypeNames,
    presenter: presenterMap.get(handler.address),
    presenterScope: scope,
    middlewares: () => getMiddlewares(handler.address),
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
          entity: handler.address,
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

export async function installFrond(frond: FrondDescriptor, assembly: Assembly): Promise<void> {
  const {
    container, routeRegistry, emissions, dispatcher, localDispatcher, effectiveByKey,
    boundPorts, refused, operationModel, entityByName, frondOf, contractsOf, getMiddlewares, use,
    log, options,
  } = assembly;

  // Declared remote: keep the scanned metadata (bridges route with it),
  // register nothing locally — resolve() falls through to the remote façade.
  if (options.remotes && frond.name in options.remotes) {
    log.child(frond.name).info('declared remote — not hosted locally');
    // Its facades answer elsewhere, but what they LISTEN to was read here.
    for (const handler of frond.handlers) {
      const key = facadeKeyOf(handler.address, handler.surface);
      const operations = operationModel.forHandler(handler);
      effectiveByKey.set(key, operations);
      emissions.note(contractsOf(operations), key);

    }
    return;
  }
  // A child hangs off its parent, so everything the parent registered answers here too and
  // nothing else has to know: `ScopeContainer.resolve` already walks up. The boot installs
  // parents first, which is what makes the key below resolvable.
  const above = frond.extends ? container.resolve<Container>(`frond:${frond.extends}`) : container;
  const scope = above.createScope();
  const frondLog = log.child(frond.name);
  // The frond's own voice, a child of the APP logger and never of `log` — which is the
  // boot's, so a service's line would have claimed `boot:` long after the boot was over.
  scope.registerValue('Logger', container.resolve<Logger>('Logger').child(frond.name));

  // `reads:` is what makes a cross-source reader exist here, and the list IS its
  // environment — a source holding none of these is never opened. Registered under
  // the type's own name, which is the key `depKeyOf` already derives for a plain
  // parameter: `constructor(private reads: Reads)` and nothing else to say.
  // Declaring `reads:` with nothing to build the reader is a boot that ignores a
  // clause: the handler asking for `Reads` then dies at its first call, on a
  // container message that names neither the clause nor what is missing.
  await registerReads(frond, scope, entityByName, options.sourcesFactory, frondLog);

  // Who owns what, and the rule that makes owning mean something. Before anything is
  // registered, so a bad line is named by this refusal rather than by the container's.
  sharedNames(frond, refused);
  const owners = ownersOf(frond.providers, frond.name, refused);
  storageInUserCode(frond, owners, (entity) => entityByName.has(entity), refused);
  crudOnOwned(frond, owners, refused);

  const declared = registerProviders(frond, scope, options.ports, boundPorts, refused, frondLog);
  // An ancestor's links stand OUTSIDE this frond's own, the order `wrapping` reads — and
  // like a middleware, a link cannot be inherited through a container key, since a seam has
  // none: its realization is built rather than resolved.
  const seams = inheritedSeams(frond, assembly.seamsOf, declared);
  assembly.seamsOf.set(frond.name, seams);

  // Register Storage for each entity — PascalCase type name (e.g. 'PostStorage')
  // When a handler declares Crud(Entity, Output), scope the storage via .output(Output)
  registerStorages(frond, assembly, scope, seams, owners, frondLog);

  // Frames, after the ORMs and before anything that may ask for one. A frame is read
  // from the same `deps` every other port is read from — asking for it IS declaring it,
  // so nothing is registered for a frame nobody wants.
  registerFrames(
    scope,
    [...frond.handlers, ...frond.providers, ...frond.presenters, ...frond.collectors]
      .flatMap((d) => d.deps.map((key) => ({ key, filePath: d.filePath }))),
    frond.providers,
    {
      entityByName,
      frondOf,
      hostedHere: (name) => !(options.remotes && name in options.remotes),
      storageFactory: options.storageFactory,
      sourceOf: options.sourceOf,
      transacts: options.transacts,
      transacted: options.transacted,
      hosting: assembly.hosting,
      log: frondLog,
    },
    refused,
  );

  // Register presenters in scope — PascalCase type name (e.g. 'PostPresenter')
  const presenterMap = new Map(frond.presenters.map((p) => [p.entityName, p]));
  for (const presenter of frond.presenters) {
    scope.register(presenterKeyOf(presenter.entityName), presenter.ctor, { deps: presenter.deps });
  }
  if (frond.presenters.length > 0) {
    frondLog.debug(`${frond.presenters.length} presenter(s): ${frond.presenters.map((p) => p.entityName).join(', ')}`);
  }

  // Register collectors in scope — PascalCase type name (e.g. 'UserCollector')
  const collectorTypeNames = new Set(frond.collectors.map((c) => c.typeName));
  for (const collector of frond.collectors) {
    const key = collectorKeyOf(collector.typeName);
    scope.register(key, collector.ctor, { deps: collector.deps });
  }
  if (frond.collectors.length > 0) {
    frondLog.debug(`${frond.collectors.length} collector(s): ${frond.collectors.map((c) => c.typeName).join(', ')}`);
  }

  // Register middlewares in scope, then take them on. Resolved per call and never here:
  // a middleware asking for something request-scoped would otherwise be handed the one
  // instance the boot built — the same reason `getMiddlewares` is read at call time.
  registerMiddlewares(frond, scope, assembly, frondLog);

  // Build handler facades → registered in ROOT container (public contract)
  const defaultHandlers = frond.handlers.filter((h) => !h.surface);
  const surfaceHandlers = frond.handlers.filter((h) => h.surface);
  const defaultHandlerMap = new Map(defaultHandlers.map((h) => [h.address, h]));

  const building: Building = { frond, assembly, scope, collectorTypeNames, presenterMap, frondLog };
  const buildFacade = (
    entity: EntityEntry | undefined,
    handler: HandlerEntry,
    targetScope: Container,
    facadeKey: string,
  ) => buildFacadeInto(building, entity, handler, targetScope, facadeKey);

  // A presenter is about an entity — computed fields sit on a shape — so this walks
  // entities. Exposing the instance lazily; the bridge resolves it on first access.
  exposePresenters(frond, presenterMap, container, scope);

  // A facade is about a handler, so this walks HANDLERS. It walked entities before,
  // which made an entity a precondition for being callable at all: a handler naming
  // none was scanned, then never built, and nothing said so.
  for (const handler of defaultHandlers) {
    // Two ways to know the subject, and the explicit one wins: `Crud(Item)` names the
    // entity it was built on, whatever the handler is called. Otherwise the handler's
    // own name is the only thing pointing at one — and pointing at nothing is legal.
    //
    // By NAME, not by identity: the scanner loads an entity through its own loader and
    // the handler imports it through the runtime's, so the same class arrives as two
    // objects. `===` compares module instances, which is not the question being asked.
    const crudTarget = targetOf(handler.ctor);
    const subject = crudTarget?.name ? lowerFirst(crudTarget.name) : handler.address;
    const entity = frond.entities.find((e) => e.name === subject);
    const facadeKey = facadeKeyOf(handler.address);
    buildFacade(entity, handler, scope, facadeKey);
    frondLog.debug(`${facadeKey} [${Object.keys(container.resolve(facadeKey) as object).join(', ')}]`
      + (entity ? '' : ' — no entity of that name: no storage, no projection, no presenter'));
  }

  // The dual, and it stays: a shape that declares no operation answers nothing. Said
  // once per entity rather than deduced from a silence.
  for (const entity of frond.entities) {
    if (!defaultHandlerMap.has(entity.name)) {
      frondLog.debug(`${entity.name} — entity only, no handler: exposes nothing`);
    }
  }

  // Surface handlers — create sub-scope per surface handler with scoped storage
  //
  // Pointing at nothing is legal HERE TOO. This loop used to `continue` when no entity
  // carried the handler's name, so `handlers/public/SearchHandler.ts` with no `Search`
  // entity got no facade at all and no line saying why — while the very same handler at
  // the default surface is built and logged. One rule, both surfaces.
  for (const handler of surfaceHandlers) {
    const entity = frond.entities.find((e) => e.name === handler.address);
    const surfaceScope = scope.createScope();

    // Register scoped storage if output override differs from entity — under the REPOSITORY
    // key, which is what a Crud handler asks for, and under the port's own for a holder
    // that legitimately names it. Registering only the latter left a named surface with
    // no facade at all once the façade stopped spelling the storage.
    if (entity) registerSurfaceStorage(entity, handler, surfaceScope, assembly, frondLog);

    const facadeKey = facadeKeyOf(handler.address, handler.surface);
    buildFacade(entity, handler, surfaceScope, facadeKey);
    frondLog.debug(`${facadeKey} [${Object.keys(container.resolve(facadeKey) as object).join(', ')}]`
      + (entity ? '' : ' — no entity of that name: no storage, no projection, no presenter'));
  }

  // A named surface is closed, so what it contains is a fact worth stating.
  // Saying it at boot is the difference between a rule and a rule you can
  // check: an entity you meant to serve and never wrote a handler for is
  // absent HERE, in one line, instead of being discovered missing later.
  const surfaceNames = [...new Set(surfaceHandlers.map((h) => h.surface as string))].sort();
  for (const surfaceName of surfaceNames) {
    const served = surfaceHandlers
      .filter((h) => h.surface === surfaceName)
      .map((h) => h.address)
      .sort();
    const absent = frond.entities.map((e) => e.name).filter((n) => !served.includes(n));
    frondLog.info(
      `surface '${surfaceName}' — ${served.length} entit${served.length === 1 ? 'y' : 'ies'}: ${served.join(', ')}` +
      (absent.length > 0 ? ` (not served: ${absent.join(', ')})` : ''),
    );
  }

  container.registerValue(`frond:${frond.name}`, scope);
  frondLog.info(`registered — ${frond.entities.length} entities, ${frond.handlers.length} handlers, ${frond.seeds.length} seeds`);
}
