import type { Container } from '@fougere/container';
import { lowerFirst, type SchemaView } from '@fougere/schema';
import type { EntityEntry, HandlerEntry, PresenterEntry } from '../scan/frond.js';
import { hostedBy } from './hosted.js';
import type { AuthRuntime } from './auth.js';
import type { CreateAppOptions, App } from './types.js';
import type { AppMiddleware } from '../wire/middleware.js';
import { Logger } from '../builtins/logger.js';
import { Config } from '../builtins/config.js';
import { createRemoteRouter, createRemoteFacade } from './remote.js';
import { registerFrames } from './together.js';
import { Emissions } from './Emissions.js';
import { HandlerFacade } from './HandlerFacade.js';
import { targetOf } from '../prefab/prefab.js';
import { ownersOf, refuseOrmInUserCode, refuseCrudOnOwned } from './ownership.js';
import type { OperationContract, OperationsMap } from '../wire/operation.js';
import {
  resolveEffectiveOperations,
  type EffectiveOperationsMap,
} from '../effective-operation.js';
import { StorageGuard } from '../dispatch/StorageGuard.js';
import { portBindings } from './ports.js';
import { InFlight } from '../dispatch/InFlight.js';
// The keys, each read from where its concept is declared — never respelled here.
import { facadeKeyOf, contractsKeyOf, identityCardOf, type RpcAnswer } from '../wire/call.js';
import { AppLifecycle } from './AppLifecycle.js';
import { repositoryKeyOf } from '../prefab/repository.js';
import { ormKeyOf } from '../orm.js';
import { presenterKeyOf } from '../prefab/presenter.js';
import { collectorKeyOf } from '../prefab/collector.js';
import { RouteAddress } from '../contract/RouteAddress.js';
import { DispatchLifecycle } from '../dispatch/DispatchLifecycle.js';
import { Dispatcher } from '../dispatch/Dispatcher.js';
import { LocalRoutePolicy } from '../dispatch/LocalRoutePolicy.js';
import { OperationRoute } from '../dispatch/OperationRoute.js';
import { RemoteRouteResolver } from '../dispatch/RemoteRouteResolver.js';
import { RouteRegistry } from '../dispatch/RouteRegistry.js';
import { FacadeEntry } from '../entry/FacadeEntry.js';


/**
 * The one wording for "nobody hosts this here", with both ways out. Said twice, and the
 * second copy (`schemaFor`) had lost the two remedies — the same dead end, strictly less
 * useful, for no reason.
 */
const notLoaded = (entity: string) =>
  `Frond for '${entity}' is not loaded.\n` +
  `  - Add '${entity}' to --fronds flag\n` +
  `  - Or declare a remote: remotes: { ${entity}: 'http://...' }`;

/**
 * Two fronds cannot claim one name — said at boot, because nothing else says it.
 *
 * A door lands on the ROOT container under `facadeKeyOf(address)`, and that key carries
 * no frond; a presenter lands there too. `registerValue` is a `Map.set`, so the second
 * frond loaded simply replaced the first and every call meant for one went to the other.
 * Silent in-process, and worse than silent under a split: `createRemoteRouter` guards its
 * index with `if (!byEntity.has(...))`, so THERE the first frond discovered wins. The same
 * application answered differently depending on how it was deployed.
 *
 * Refusing is the honest answer while a key cannot say which frond owns it. It is not the
 * last word: qualify the key and this boot can accept both. ORMs and repositories are not
 * checked because they are registered in the frond's own scope, where two fronds do not meet.
 *
 * A frond declared remote registers nothing locally, so it cannot collide here. Two REMOTE
 * fronds publishing one entity still shadow each other inside the router — a hole this
 * check does not reach.
 */
function assertOneOwnerPerKey(
  fronds: { name: string; handlers: HandlerEntry[]; presenters: PresenterEntry[] }[],
  remotes: Record<string, string> | undefined,
): void {
  const owner = new Map<string, string>();

  const claim = (key: string, frond: string, what: string) => {
    const held = owner.get(key);
    if (held !== undefined && held !== frond) {
      throw new Error(
        `Two fronds claim the key '${key}': '${held}' and '${frond}'.\n`
        + `  A ${what} is registered under a key that names no frond, so one would silently replace the other.\n`
        + `  - Rename one of the two classes, or\n`
        + `  - keep one of the two fronds out of this process (--fronds), or declare it in remotes:`,
      );
    }
    owner.set(key, frond);
  };

  for (const frond of fronds) {
    if (remotes && frond.name in remotes) continue;
    for (const handler of frond.handlers) claim(facadeKeyOf(handler.address, handler.surface), frond.name, 'door');
    for (const presenter of frond.presenters) claim(presenterKeyOf(presenter.entityName), frond.name, 'presenter');
  }
}

/** Bootstrap a fougere application. */
export async function createApp(options: CreateAppOptions): Promise<App> {
  const container = options.createContainer();
  // Boot chatter is debug by default; a host (e.g. the CLI) can quiet it.
  const log = new Logger('boot:app');

  // Builtins — registered under class name (PascalCase) for type-based DI.
  // No level here and none anywhere: a logger consults `setLogLevel`'s value at each
  // emission, so this instance survives a level change and so does every handler that
  // was handed it. A frond declaring `class X extends Logger` takes this key over,
  // like any other port.
  container.registerValue('Logger', new Logger('app'));
  container.register('Config', Config, { lifetime: 'singleton' });
  log.debug('builtins registered (Logger, Config)');

  // What this app hosts is HANDED IN — stated, scanned, or both (`hostedBy`). Producing
  // it may read a disk; consuming it never does, which is the whole reason this file names
  // no builtin and a Worker can run what it builds.
  const scanStart = performance.now();
  const { fronds, diagnostics } = await hostedBy(options);
  const operationModel = resolveEffectiveOperations(fronds, {
    diagnostics,
    remotes: options.remotes,
    adapters: options.adapters,
  });
  const scanMs = (performance.now() - scanStart).toFixed(0);
  const blocking = diagnostics.filter((d) => d.severity === 'blocking');
  log.info(`read ${fronds.length} frond(s) in ${scanMs}ms`
    + (diagnostics.length ? ` — ${diagnostics.length} thing(s) the scan could not do` : ''));

  /**
   * Say what could not be read, at the one line everyone already watches.
   *
   * Not a refusal: an app whose `presenters/` is unreadable still serves its
   * entities, and stopping the boot would trade a partial app for none. But it is
   * an ERROR, not a debug line — the app now serves less than its source declares,
   * and nothing downstream can tell that from a source that declares less.
   */
  for (const d of blocking) log.error(`[${d.code}] ${d.message}`, d.cause);
  for (const d of diagnostics) if (d.severity === 'warning') log.warn(`[${d.code}] ${d.message}`);

  /**
   * An ambiguous convention is not a partial scan. Every relevant declaration was read,
   * but more than one executable contract can be built from it. Refuse before auth,
   * storage, migrations or seeds make the boot observable.
   */
  const invalidOperations = operationModel.resolutionDiagnostics
    .filter((diagnostic) => diagnostic.severity === 'blocking');
  if (invalidOperations.length > 0) {
    const details = invalidOperations.map((d) =>
      `  [${d.code}]${d.subject ? ` ${d.subject}` : ''}\n    ${d.message}\n    ${d.filePath}`,
    );
    throw new Error(
      `Fougere boot refused: ${invalidOperations.length} unresolved operation contract(s):\n`
      + details.join('\n'),
    );
  }

  // Auth runtime — built once from the lazy AuthConfig produced by a provider factory
  // (e.g. betterAuth({...})) in fougere.config.ts. The provider receives our db +
  // ormFactory so all auth writes flow through EntityOrm.
  let authRuntime: AuthRuntime | undefined;
  if (options.auth) {
    if (!options.ormFactory) {
      throw new Error('createApp: `auth` is set but `ormFactory` is missing — auth providers need it to back their adapter.');
    }
    if (options.db === undefined) {
      throw new Error('createApp: `auth` is set but `db` is missing — pass the storage handle through CreateAppOptions.db.');
    }
    log.info('initializing auth runtime');
    authRuntime = await options.auth.create({
      db: options.db,
      ormFactory: options.ormFactory,
    });
    log.info(`auth ready — mounted at ${authRuntime.basePath}`);
  }

  // Remote routing — judged at boot: declaring remotes without a transport is a config error.
  // A remote declaration wins over local presence: `remotes: { blog: url }` IS
  // the topology statement — the frond's code may sit in fronds/**, it runs elsewhere.
  const declaredRemotes = Object.entries(options.remotes ?? {});
  if (declaredRemotes.length > 0 && !options.remoteTransport) {
    throw new Error(
      'createApp: `remotes` is declared but `remoteTransport` is missing — pass one (e.g. from @fougere/transport-http).',
    );
  }
  const remoteRouter = declaredRemotes.length > 0 && options.remoteTransport
    ? createRemoteRouter(Object.fromEntries(declaredRemotes), options.remoteTransport)
    : undefined;

  // What is running on this app — counted at the one door every caller goes through,
  // so releasing it can wait for the work instead of pulling the floor out.
  const inflight = new InFlight();

  // Middleware storage — read at call time, not at boot time
  const globalMiddlewares: AppMiddleware[] = [];
  const scopedMiddlewares = new Map<string, AppMiddleware[]>();
  /** What this app took on beyond its fronds. Its `up` is the last thing the boot does. */
  const appLifecycle = new AppLifecycle().add(...(options.extensions ?? []));
  const routeRegistry = new RouteRegistry();
  const dispatchLifecycle = new DispatchLifecycle(
    options.dispatchObservers,
    (error, event) => log.error(
      `[dispatch-observer] ${event.stage} ${event.call.address.toString()}`,
      error,
    ),
  );
  const dispatcher = new Dispatcher(routeRegistry, inflight, dispatchLifecycle);
  const localDispatcher = new Dispatcher(
    routeRegistry,
    inflight,
    dispatchLifecycle,
    new LocalRoutePolicy((surface) => fronds.servedNames(surface)),
  );

  function getMiddlewares(entity: string): AppMiddleware[] {
    const scoped = scopedMiddlewares.get(entity) ?? [];
    return [...globalMiddlewares, ...scoped];
  }

  assertOneOwnerPerKey(fronds, options.remotes);

  // Every entity of every frond, by name — so a fact can be judged where it LANDS, and
  // so a `reads:` clause can name a neighbour's.
  const entityByName = fronds.schemas();
  // Which frond holds an entity — what turns "a member is remote" into a refusal that
  // names the frond rather than the entity, since `remotes:` is declared per frond.
  const frondOf = new Map(fronds.flatMap((f) => f.entities.map((e) => [e.name, f.name] as const)));
  const emissions = new Emissions(fronds, entityByName, container, log, options.onEmit);
  /** Canonical operation tables, indexed by the same audience key as their facades. */
  const effectiveByKey = new Map<string, EffectiveOperationsMap>();

  const contractsOf = (operations: EffectiveOperationsMap): OperationsMap => new Map(
    [...operations].map(([name, operation]) => [name, operation as OperationContract] as const),
  );

  // Every port an implementation was bound to, so a `ports:` entry that named none
  // can say so rather than look obeyed.
  const boundPorts = new Set<string>();

  // Register frond scopes
  for (const frond of fronds) {
    // Declared remote: keep the scanned metadata (bridges route with it),
    // register nothing locally — resolve() falls through to the remote façade.
    if (options.remotes && frond.name in options.remotes) {
      log.child(frond.name).info('declared remote — not hosted locally');
      // Its doors answer elsewhere, but what they LISTEN to was read here.
      for (const handler of frond.handlers) {
        const key = facadeKeyOf(handler.address, handler.surface);
        const operations = operationModel.forHandler(handler);
        effectiveByKey.set(key, operations);
        emissions.note(contractsOf(operations), key);

      }
      continue;
    }
    const scope = container.createScope();
    const frondLog = log.child(frond.name);

    // `reads:` is what makes a cross-source reader exist here, and the list IS its
    // environment — a source holding none of these is never opened. Registered under
    // the type's own name, which is the key `depKeyOf` already derives for a plain
    // parameter: `constructor(private sources: Sources)` and nothing else to say.
    // Declaring `reads:` with nothing to build the reader is a boot that ignores a
    // clause: the handler asking for `Sources` then dies at its first call, on a
    // container message that names neither the clause nor what is missing.
    if (frond.reads?.length && !options.sourcesFactory) {
      frondLog.warn(
        `[reads] ${frond.reads.join(', ')} — declared in frond.config.ts, but this boot passes no `
        + '`sourcesFactory`, so no reader is registered and a handler asking for `Sources` will fail '
        + 'at its first call. Pass one (`@fougere/adapter-duckdb`), or drop the clause.',
      );
    }
    if (frond.reads?.length && options.sourcesFactory) {
      // Resolved across the WHOLE app, not this frond's own entities: a cross-source
      // query joins entities from different fronds by definition — `Progress` here,
      // `Book` next door — so restricting the list to its own would make it useless.
      // Naming one IS the authorization; that is what the declaration is for.
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
      scope.registerValue('Sources', await options.sourcesFactory(named, frond.name));
      frondLog.debug(`cross-source reader over ${named.length} entit(ies)`);
    }

    // Who owns what, and the rule that makes owning mean something. Before anything is
    // registered, so a bad line is named by this refusal rather than by the container's.
    const owners = ownersOf(frond.providers);
    refuseOrmInUserCode(frond, owners);
    refuseCrudOnOwned(frond, owners);

    for (const provider of frond.providers) {
      scope.register(provider.ctor.name, provider.ctor, { deps: provider.deps });
    }
    // …and again under the port each one extends, so `private payment: Payment`
    // reaches the realization instead of the base class it is declared against.
    // Registered AFTER the loop above so a port key always wins over the base's
    // own registration — same precedence as a declared repository over its default.
    for (const [port, impl] of portBindings(frond.providers, (n) => scope.has(n), options.ports)) {
      scope.register(port, impl.ctor, { deps: impl.deps });
      boundPorts.add(port);
      frondLog.debug(`port ${port} → ${impl.ctor.name}`);
    }
    if (frond.providers.length > 0) {
      frondLog.debug(`${frond.providers.length} provider(s): ${frond.providers.map((p) => p.ctor.name).join(', ')}`);
    }

    // Register EntityOrm for each entity — PascalCase type name (e.g. 'PostOrm')
    // When a handler declares Crud(Entity, Output), scope the ORM via .output(Output)
    if (options.ormFactory) {
      for (const entity of frond.entities) {
        const ormName = ormKeyOf(entity.name);
        const baseOrm = options.ormFactory(entity.entityClass, entity.name);

        // Check if the default handler (no surface) declares an output override
        const defaultHandler = frond.handlers.find((h) => h.address === entity.name && !h.surface);
        const outputSchema = defaultHandler?.outputOverride ?? (defaultHandler?.ctor as any)?.__output;
        const scoped = outputSchema && outputSchema !== entity.entityClass
          ? baseOrm.output(outputSchema)
          : baseOrm;

        // Storage is a way out like the client surface — see `StorageGuard`.
        const guarded = new StorageGuard(entity.entityClass.getFields(), entity.name).guard(scoped);
        scope.registerValue(ormName, guarded);

        // The default repository IS the guarded port — it already answers every gesture a
        // declared one forwards, so the two forms have the same shape and a handler reads
        // `repo.list()` either way. The wrapper that used to sit here (`{ orm: guarded }`)
        // existed to make `repo.orm` true in both, back when `.orm` was the way in.
        //
        // Not registered for an OWNED entity: an aggregate's members are reached through it
        // and nowhere else, and the default would be a second door under a name a handler
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
        frondLog.debug(`${frond.entities.length} entity ORM(s): ${frond.entities.map((e) => e.name).join(', ')}`);
      }
    }

    // Frames, after the ORMs and before anything that may ask for one. A frame is read
    // from the same `deps` every other port is read from — asking for it IS declaring it,
    // so nothing is registered for a frame nobody wants.
    registerFrames(
      scope,
      [...frond.handlers, ...frond.providers, ...frond.presenters, ...frond.collectors].flatMap((d) => d.deps),
      frond.providers,
      {
        entityByName,
        frondOf,
        hostedHere: (name) => !(options.remotes && name in options.remotes),
        ormFactory: options.ormFactory,
        sourceOf: options.sourceOf,
        transacted: options.transacted,
        log: frondLog,
      },
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

    // Build handler facades → registered in ROOT container (public contract)
    const defaultHandlers = frond.handlers.filter((h) => !h.surface);
    const surfaceHandlers = frond.handlers.filter((h) => h.surface);
    const defaultHandlerMap = new Map(defaultHandlers.map((h) => [h.address, h]));

    /** Build the door of a handler and register it under the audience it serves. */
    const buildFacade = (
      entity: EntityEntry | undefined,
      handler: HandlerEntry,
      targetScope: Container,
      facadeKey: string,
    ) => {
      const facade = new HandlerFacade(
        {
          handler,
          handlers: frond.handlers,
          entity,
          scope: targetScope,
          key: facadeKey,
          operations: operationModel.forHandler(handler),
        },
        {
          frond: frond.name,
          frondScope: scope,
          log: frondLog,
          collectors: collectorTypeNames,
          presenters: presenterMap,
          middlewaresFor: getMiddlewares,
          emissions,
        },
      );
      // The terms alongside the door, under the same audience — a surface that serves
      // fewer ops describes fewer ops.
      container.registerValue(contractsKeyOf(handler.address, handler.surface), facade.contracts);
      effectiveByKey.set(facadeKey, facade.effectiveOperations);

      const surfaces = new Set<string | undefined>([handler.surface]);
      if (!handler.surface) {
        for (const [surface, names] of Object.entries(frond.surfaces ?? {})) {
          const isDeclared = names.some((name) =>
            name.toLowerCase() === handler.address.toLowerCase());
          const hasOwnDoor = surfaceHandlers.some((candidate) =>
            candidate.surface === surface && candidate.address === handler.address);
          if (isDeclared && !hasOwnDoor) surfaces.add(surface);
        }
      }

      for (const operation of facade.contracts.keys()) {
        for (const surface of surfaces) {
          const address = new RouteAddress({
            entity: handler.address,
            operation,
            ...(surface !== undefined ? { surface } : {}),
          });
          routeRegistry.register(new OperationRoute(
            'local',
            address,
            (call) => facade.ops[operation](call.invocation),
          ));
        }
      }

      const entry = new FacadeEntry(
        handler.surface ? localDispatcher : dispatcher,
        handler.address,
        routeRegistry.operationNames(handler.address, handler.surface),
        handler.surface,
      );
      container.registerValue(facadeKey, entry.operations);
    };

    // A presenter is about an entity — computed fields sit on a shape — so this walks
    // entities. Exposing the instance lazily; the bridge resolves it on first access.
    for (const entity of frond.entities) {
      if (!presenterMap.has(entity.name)) continue;
      const presenterKey = presenterKeyOf(entity.name);
      let presenterInstance: any;
      container.registerValue(presenterKey, new Proxy({} as any, {
        get(_target, prop) {
          if (!presenterInstance) presenterInstance = scope.resolve(presenterKey);
          return presenterInstance[prop];
        },
      }));
    }

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
      frondLog.debug(`${facadeKey} [${Object.keys(container.resolve(facadeKey) as any).join(', ')}]`
        + (entity ? '' : ' — no entity of that name: no ORM, no projection, no presenter'));
    }

    // The dual, and it stays: a shape that declares no operation answers nothing. Said
    // once per entity rather than deduced from a silence.
    for (const entity of frond.entities) {
      if (!defaultHandlerMap.has(entity.name)) {
        frondLog.debug(`${entity.name} — entity only, no handler: exposes nothing`);
      }
    }

    // Surface handlers — create sub-scope per surface handler with scoped ORM
    //
    // Pointing at nothing is legal HERE TOO. This loop used to `continue` when no entity
    // carried the handler's name, so `handlers/public/SearchHandler.ts` with no `Search`
    // entity got no door at all and no line saying why — while the very same handler at
    // the default surface is built and logged. One rule, both surfaces.
    for (const handler of surfaceHandlers) {
      const entity = frond.entities.find((e) => e.name === handler.address);
      const surfaceScope = scope.createScope();

      // Register scoped ORM if output override differs from entity — under the REPOSITORY
      // key, which is what a Crud handler asks for, and under the port's own for a holder
      // that legitimately names it. Registering only the latter left a named surface with
      // no door at all once the façade stopped spelling the storage.
      if (entity && options.ormFactory) {
        const baseOrm = options.ormFactory(entity.entityClass, entity.name);
        const outputSchema = handler.outputOverride ?? (handler.ctor as any).__output;
        const scoped = outputSchema && outputSchema !== entity.entityClass
          ? baseOrm.output(outputSchema)
          : baseOrm;
        const guarded = new StorageGuard(entity.entityClass.getFields(), entity.name).guard(scoped);
        surfaceScope.registerValue(ormKeyOf(entity.name), guarded);
        surfaceScope.registerValue(repositoryKeyOf(entity.name), guarded);
      }

      const facadeKey = facadeKeyOf(handler.address, handler.surface);
      buildFacade(entity, handler, surfaceScope, facadeKey);
      frondLog.debug(`${facadeKey} [${Object.keys(container.resolve(facadeKey) as any).join(', ')}]`
        + (entity ? '' : ' — no entity of that name: no ORM, no projection, no presenter'));
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

  // A `ports:` key that matched no port anywhere reads as a choice that was made, and
  // was not. Said once, at the end, because the entry is app-wide while a port is a
  // frond's — no single frond can tell whether a key is a typo or a neighbour's.
  const unused = Object.keys(options.ports ?? {}).filter((port) => !boundPorts.has(port));
  if (unused.length > 0) {
    log.warn(
      `[ports] ${unused.join(', ')} — named in fougere.config.ts, but no scanned class extends `
      + 'them, so nothing was chosen. Check the spelling, or drop the entry.',
    );
  }

  // Once every door exists: what is announced here and what is listened to are both known.
  emissions.register();

  /**
   * The last resort, held by the container so every resolution path shares it.
   *
   * It used to live on `app.resolve` alone, which meant the runner found a remote façade
   * and dependency injection did not — a handler asking for a neighbour that had moved
   * got `is not registered` while the very same call over the wire worked. One door now.
   *
   * Surface-scoped keys ('admin:productHandler') stay local: a named surface resolves in
   * this container only, so fabricating one for a remote frond would answer NOT_FOUND on
   * everything (see Known issues).
   */
  container.setFallback?.((name) => {
    if (!remoteRouter) return undefined;
    if (!name.endsWith('Handler') || name.includes(':')) return undefined;
    // Façade-shaped stand-in; routing happens lazily at the first call. Through
    // `lowerFirst` because a DEPENDENCY names the type as written — `ProductHandler`,
    // PascalCase — while a card declares `product`, so the raw strip asked the router for
    // 'Product' and every by-type dependency on a remote handler answered NOT_FOUND.
    return new FacadeEntry(
      dispatcher,
      lowerFirst(name.replace(/Handler$/, '')),
    ).operations;
  });

  /**
   * Everything this app holds, let go in reverse of how it was taken: what an extension
   * took on last, then the container's own, then whoever handed a resource in.
   *
   * It does NOT wait for running calls — `drain()` is that, and it is a separate gesture
   * because waiting and releasing do not have the same owner: a test releases at once, a
   * host turning the ring wants the work finished first.
   */
  const release = async (): Promise<void> => {
    // Every level is told to close even when one refuses, and the refusals leave together —
    // the rule `Lifecycle.down` applies INSIDE its list, applied ACROSS the three. Stated
    // there and broken here, a refusing extension took the container and the connection
    // down with it, which is the leak this gesture exists to prevent.
    const refused: unknown[] = [];
    for (const level of [() => appLifecycle.down(app), () => container.dispose(), () => options.onDispose?.()]) {
      try {
        await level();
      } catch (error) {
        // Flattened one level: an extension's refusals are already an AggregateError, and
        // nesting them would make the caller unwrap twice to read one list.
        if (error instanceof AggregateError) refused.push(...error.errors);
        else refused.push(error);
      }
    }
    if (refused.length > 0) {
      throw new AggregateError(refused, `${refused.length} refusal(s) while releasing the app`);
    }
  };

  /**
   * Stop taking calls, and resolve once the ones already running are done.
   *
   * Refuses on `timeoutMs` rather than resolving anyway: a drain that gives up quietly
   * reads exactly like a drain that succeeded, and the caller — who is about to release
   * a storage connection under whatever is left — is the one who must decide.
   */
  const drain = async (timeoutMs?: number): Promise<void> => {
    inflight.close();
    if (timeoutMs === undefined) return inflight.whenIdle();
    let timer: ReturnType<typeof setTimeout>;
    await Promise.race([
      inflight.whenIdle().then(() => clearTimeout(timer)),
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`[drain] ${inflight.count} call(s) still running after ${timeoutMs}ms`)),
          timeoutMs,
        );
      }),
    ]);
  };

  const resolve = <T>(name: string): T => {
    try {
      return container.resolve<T>(name);
    } catch (err) {
      if (name.endsWith('Handler') && !name.includes(':') && !remoteRouter) {
        throw new Error(notLoaded(name.replace(/Handler$/, '')));
      }
      throw err;
    }
  };

  const schemaFor = async (entity: string): Promise<SchemaView> => {
    const found = fronds.entity(entity);
    if (found) return found.entityClass;
    if (remoteRouter) {
      const route = await remoteRouter.route(entity);
      // A remote door that stores nothing publishes ops and no shape. Saying so beats
      // handing back an empty schema, which would validate every input it was given.
      if (!route.schema) {
        throw new Error(
          `'${entity}' is served by frond '${route.frond}' but stores no rows, so it has no schema. `
          + `Call its operations through the façade instead.`,
        );
      }
      return route.schema;
    }
    throw new Error(notLoaded(entity));
  };

  const facadeAt = (key: string, topology: boolean): Record<string, Function> | undefined => {
    try {
      return topology
        ? resolve<Record<string, Function>>(key)
        : container.resolve<Record<string, Function>>(key);
    } catch {
      return undefined;
    }
  };

  /**
   * THE membership rule, stated once — every projection reads this and nothing
   * else. It used to live twice, verbatim, in the REST and GraphQL adapters,
   * and two other readers invented their own answer.
   *
   * Naming an audience closes it. Two ways to name an entity into a surface,
   * in precedence order:
   *   - `surfaces:` in frond.config.ts — when the list exists, it IS the list;
   *   - a handler under `handlers/<surface>/` — which also restricts the façade.
   * `@expose` is a THIRD way and this rule does not read it: the scan sets a
   * boolean, read by the two adapters and by `exposedAdapters` — never here.
   * What neither of the two names is not served. It used to be the reverse: no
   * `public:categoryHandler` meant the FULL CategoryHandler rode the public
   * door, create/update/delete included (measured on demos/nuxt-blog).
   *
   * A named entity with no façade of its own falls back to the default one —
   * that is not the old widening, it is the author saying "this one, as it is".
   * The leak was exposure with no statement behind it.
   *
   * A surface key stays local: a doublure serves whatever the remote's own door
   * serves, which is the remote's business and not ours to re-audience.
   */
  const facadeFor = (entity: string, surface?: string): Record<string, Function> | undefined => {
    if (!surface) return facadeAt(facadeKeyOf(entity), true);

    const own = facadeAt(facadeKeyOf(entity, surface), false);
    const declared = fronds.owner(entity)?.surfaces?.[surface];
    if (!declared) return own;
    if (!declared.some((n) => n.toLowerCase() === entity.toLowerCase())) return undefined;
    if (own) return own;

    const fallback = facadeAt(facadeKeyOf(entity), false);
    return fallback
      ? new FacadeEntry(
          localDispatcher,
          entity,
          routeRegistry.operationNames(entity, surface),
          surface,
        ).operations
      : undefined;
  };

  if (remoteRouter) {
    const remoteFacades = new Map<string, Record<string, Function>>();
    routeRegistry.addResolver(new RemoteRouteResolver((entity) => {
      const known = remoteFacades.get(entity);
      if (known) return known;
      const facade = createRemoteFacade(entity, remoteRouter, getMiddlewares);
      remoteFacades.set(entity, facade);
      return facade;
    }));
  }

  /** The terms beside a door, with the exact same named-surface fallback rule. */
  const operationsFor = (entity: string, surface?: string): EffectiveOperationsMap | undefined => {
    if (!surface) return effectiveByKey.get(facadeKeyOf(entity));

    const own = effectiveByKey.get(facadeKeyOf(entity, surface));
    const declared = fronds.owner(entity)?.surfaces?.[surface];
    if (!declared) return own;
    return declared.some((name) => name.toLowerCase() === entity.toLowerCase())
      ? (own ?? effectiveByKey.get(facadeKeyOf(entity)))
      : undefined;
  };

  /**
   * The storage an entity is backed by — the dual of `facadeFor`, which serves its
   * client-facing door. Both are ways in; an entity that opens none of them still has rows.
   *
   * It resolves through the owning frond's scope, because that is where entity ORMs live:
   * `resolve('UserOrm')` reads the ROOT container and never finds one, so callers outside
   * the frond concluded there was no storage. The seed loop did exactly that, and skipped
   * every entity with no façade — the one case its own fallback existed for.
   */
  const ormFor = (entity: string): unknown | undefined => {
    const owner = fronds.owner(entity);
    if (!owner) return undefined;

    const key = ormKeyOf(entity);
    try {
      return container.resolve<Container>(`frond:${owner.name}`).resolve(key);
    } catch {
      return undefined;
    }
  };

  /**
   * The presenter of an entity, resolved through its owning frond's scope.
   *
   * Same shape as `ormFor`, and it exists for the same reason: without it an adapter
   * has to spell the container key itself. `schema-graphql` did — a hand-written
   * `${Name}Presenter` — and a key respelled elsewhere finds nothing and says nothing
   * the day the convention moves, which is exactly the failure `verify.ts` refuses.
   */
  const presenterFor = (entity: string): unknown | undefined => {
    const owner = fronds.owner(entity);
    if (!owner) return undefined;

    try {
      return container.resolve<Container>(`frond:${owner.name}`).resolve(presenterKeyOf(entity));
    } catch {
      return undefined;
    }
  };

  const app: App = {
    container,
    fronds,
    // What this app publishes, straight from fougere.config.ts — the doors read it,
    // so an undeclared adapter serves nothing whatever a host mounted.
    adapters: options.adapters ?? {},
    // Where a call goes, as DECLARED. Kept because a reader needs it beside what the
    // runtime OBSERVED — `rpc.topology` calls a frond remote because it answered, never
    // because a key said so, and the two disagree exactly when something is misconfigured.
    remotes: Object.freeze({ ...(options.remotes ?? {}) }),
    dispatch: (call) => dispatcher.dispatch(call),
    local: localDispatcher,
    resolve,
    schemaFor,
    facadeFor,
    operationsFor,
    listensTo: () => emissions.listensTo(),
    deliver: (fact, payload) => emissions.deliver(fact, payload),
    ormFor,
    presenterFor,
    dispose: release,
    drain,
    inFlight: () => inflight.count,
    [Symbol.asyncDispose]: release,
    serveRpc(op: string, answer: RpcAnswer): void {
      // Refused rather than replaced: two declarations of one name would make the answer
      // depend on wiring order, and `discover` is in here precisely so it cannot be taken.
      const address = new RouteAddress({ entity: 'rpc', operation: op });
      if (routeRegistry.find(address)) {
        throw new Error(`rpc operation '${op}' is already served; a second declaration would depend on wiring order`);
      }
      routeRegistry.register(new OperationRoute(
        'system',
        address,
        (call) => answer(call.invocation, call.address.surface),
      ));
    },
    extensions: () => appLifecycle.names(),
    observe(observer) {
      return dispatchLifecycle.add(observer);
    },
    use(...args: [AppMiddleware] | [string, AppMiddleware]): void {
      if (typeof args[0] === 'string') {
        const [entity, mw] = args as [string, AppMiddleware];
        const list = scopedMiddlewares.get(entity) ?? [];
        list.push(mw);
        scopedMiddlewares.set(entity, list);
      } else {
        globalMiddlewares.push(args[0] as AppMiddleware);
      }
    },
    auth: authRuntime,
  };

  // The card is an rpc op like any other, so one registry answers and one refusal names
  // what is served. A package's op is declared the same way, from outside.
  app.serveRpc('discover', (_invocation, surface) => identityCardOf(app, surface));

  // The last thing the boot does, and the first thing a release undoes. An extension may
  // await here — which is what a provider needing to OPEN something could never do.
  await appLifecycle.up(app);

  return app;
}
