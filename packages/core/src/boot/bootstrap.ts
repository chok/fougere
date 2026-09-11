import type { Container } from '@fougere/container';
import { lowerFirst, type Fields, type SchemaView } from '@fougere/schema';
import { nameOf } from '../descriptor/frond.js';
import type { EntityEntry, HandlerEntry, PresenterEntry } from '../descriptor/frond.js';
import { hostedBy } from './hosted.js';
import { installFrond, type Assembly } from './install.js';
import type { AuthRuntime } from './auth.js';
import type { CreateAppOptions, App } from './types.js';
import type { AppMiddleware } from '../wire/middleware.js';
import { Carry, Logger } from '../builtin/logger.js';
import type { LogRecord } from '../builtin/logger.js';
import LogLine, { CARRIES_LINE } from '../builtin/LogLine.js';
import { emitKeyOf, type Emit } from '../wire/emit.js';

/** The fact the boot announces, spelled once. */
const LOG_LINE = lowerFirst(LogLine.name);
import { Config } from '../builtin/config.js';
import { createRemoteRouter, createRemoteFacade } from './remote.js';
import { registerFrames } from './together.js';
import { Emissions } from './Emissions.js';
import { HandlerFacade } from '../dispatch/HandlerFacade.js';
import { targetOf } from '../prefab/prefab.js';
import { ownersOf, refuseStorageInUserCode, refuseCrudOnOwned } from './ownership.js';
import type { OperationContract, OperationsMap } from '../wire/operation.js';
import {
  resolveEffectiveOperations,
  type EffectiveOperationsMap,
} from '../effective-operation.js';
import { StorageGuard } from '../dispatch/StorageGuard.js';
import { portBindings, seamChains } from './ports.js';
import { InFlight } from '../dispatch/InFlight.js';
// The keys, each read from where its concept is declared — never respelled here.
import { facadeKeyOf, contractsKeyOf, type RpcAnswer } from '../wire/call.js';
import { identityCardOf } from './card.js';
import { AppLifecycle, migrating } from './AppLifecycle.js';
import { seeding } from './seed.js';
import { inheritsCrud, subjectOf } from '../prefab/crud.js';
import { repositoryKeyOf } from '../prefab/repository.js';
import { storageKeyOf } from '../storage/port.js';
import { declares } from '../source.js';
import { presenterKeyOf } from '../prefab/presenter.js';
import { collectorKeyOf } from '../prefab/collector.js';
import { RouteAddress } from '../wire/RouteAddress.js';
import { DispatchLifecycle } from '../dispatch/DispatchLifecycle.js';
import { Dispatcher } from '../dispatch/Dispatcher.js';
import { LocalRoutePolicy } from '../dispatch/LocalRoutePolicy.js';
import { servedSurfaces } from '../descriptor/surface.js';
import { OperationRoute } from '../dispatch/OperationRoute.js';
import { remoteRoutes } from '../dispatch/remoteRoutes.js';
import { RouteRegistry } from '../dispatch/RouteRegistry.js';
import { facadeOperations } from '../entry/facade.js';


/** The one wording for "nobody hosts this here", with both ways out. */
const notLoaded = (entity: string) =>
  `Frond for '${entity}' is not loaded.\n` +
  `  - Add '${entity}' to --fronds flag\n` +
  `  - Or declare a remote: remotes: { ${entity}: 'http://...' }`;

/** Two fronds cannot claim one name — said at boot, because nothing else says it. */
function assertOneOwnerPerKey(
  fronds: { name: string; handlers: HandlerEntry[]; presenters: PresenterEntry[] }[],
  remotes: Record<string, string> | undefined,
): void {
  const owner = new Map<string, string>();

  const claim = (key: string, frond: string, what: string) => {
    const first = owner.get(key);
    if (first !== undefined && first !== frond) {
      throw new Error(
        `Two fronds claim the key '${key}': '${first}' and '${frond}'.\n`
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

  // Held out here, and not where the ascent reads it, because releasing needs it and
  // releasing has to work from the first line the boot takes something.
  // The conventional ascent, ordered here: tables, then rows, then whatever the host took
  // on. Four hosts assembled these two members themselves — the order is not theirs to
  // choose, and a host that forgot lost its migration in silence.
  const appLifecycle = new AppLifecycle().add(
    migrating(options.migrate),
    seeding(),
    ...(options.extensions ?? []),
  );
  /** The app once it exists — a refusal before that releases the two levels that do. */
  let built: App | undefined;
  /** Where THIS boot's lines wait — never a process-wide slot, see `Carry`. */
  const carry = new Carry();
  /** Given back by `carry.to`, so a released app stops writing into a dead container. */
  let stopAnnouncing: (() => void) | undefined;

  /**
   * Everything this app holds, let go in reverse of how it was taken: what an extension took on
   * last, then the container's own, then whoever handed a resource in.
   */
  const release = async (): Promise<void> => {
    // Every level is told to close even when one refuses, and the refusals leave together —
    // the rule `Lifecycle.down` applies INSIDE its list, applied ACROSS the three. Stated
    // there and broken here, a refusing extension took the container and the connection
    // down with it, which is the leak this gesture exists to prevent.
    const refused: unknown[] = [];
    // Whatever is still held will never reach a destination — the console had it.
    stopAnnouncing?.();
    carry.forget();
    const levels = [
      ...(built ? [() => appLifecycle.down(built!)] : []),
      () => container.dispose(),
      () => options.onDispose?.(),
    ];
    for (const level of levels) {
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

  try {
    // Boot chatter is debug by default; a host (e.g. the CLI) can quiet it.
    const log = new Logger('boot:app', { carry });

    // Builtins — registered under class name (PascalCase) for type-based DI.
    // No level here and none anywhere: a logger consults `setLogLevel`'s value at each
    // emission, so this instance survives a level change and so does every handler that
    // was handed it. A frond declaring `class X extends Logger` takes this key over,
    // like any other port.
    container.registerValue('Logger', new Logger('app', { carry }));
    container.register('Config', Config, { lifetime: 'singleton' });
    log.debug('builtins registered (Logger, Config)');

    // What this app hosts is HANDED IN — stated, scanned, or both (`hostedBy`). Producing
    // it may read a disk; consuming it never does, which is the whole reason this file names
    // no builtin and a Worker can run what it builds.
    const scanStart = performance.now();
    // An extension's fronds sit beside the app's own: it is installed like any other, and
    // its handlers resolve at call time — by which point the extension's `up` has put what
    // they ask for in the container.
    const brought = (options.extensions ?? [])
      .flatMap((extension) => extension?.fronds ?? [])
      .map((frond) => ({ ...frond, brought: true as const }));
    const { fronds, diagnostics } = await hostedBy(
      brought.length > 0 ? { ...options, fronds: [...(options.fronds ?? []), ...brought] } : options,
    );
    // An app that states nothing AND scans nothing is a mistake — unless something else it
    // declares brings its own entities, which an auth provider does. Refused here and not in
    // `hostedBy`, which is handed the frond sources and cannot see the rest of the app. The
    // condition is the KEYS, not the count: a scan that found nothing is an ordinary answer.
    if (!options.fronds && !options.scan && !options.auth && brought.length === 0) {
      throw new Error(
        'createApp needs `fronds:` (what this app states) or `scan:` (what a scanner found). '
        + 'Neither was given, and nothing else declares entities of its own.',
      );
    }
    const operationModel = resolveEffectiveOperations(fronds, {
      diagnostics,
      remotes: options.remotes,
      adapters: options.adapters,
    });
    const scanMs = (performance.now() - scanStart).toFixed(0);
    const blocking = diagnostics.filter((d) => d.severity === 'blocking');
    log.info(`read ${fronds.length} frond(s) in ${scanMs}ms`
      + (diagnostics.length ? ` — ${diagnostics.length} thing(s) the scan could not do` : ''));

    /** Say what could not be read, at the one line everyone already watches. */
    for (const d of blocking) log.error(`[${d.code}] ${d.message}`, d.cause);
    for (const d of diagnostics) if (d.severity === 'warning') log.warn(`[${d.code}] ${d.message}`);

    /** An ambiguous convention is not a partial scan. */
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
    // storageFactory so all auth writes flow through Storage.
    let authRuntime: AuthRuntime | undefined;
    if (options.auth) {
      if (!options.storageFactory) {
        throw new Error('createApp: `auth` is set but `storageFactory` is missing — auth providers need it to back their adapter.');
      }
      if (options.db === undefined) {
        throw new Error('createApp: `auth` is set but `db` is missing — pass the storage handle through CreateAppOptions.db.');
      }
      log.info('initializing auth runtime');
      authRuntime = await options.auth.create({
        db: options.db,
        storageFactory: options.storageFactory,
      });
      log.info(`auth ready — mounted at ${authRuntime.basePath}`);
    }

    // Remote routing — validated at boot: declaring remotes without a transport is a config error.
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

    /**
     * The one place a middleware is taken on. `App.use` is its late form, and a frond's
     * `middlewares/` its early one — the app does not exist yet while fronds install.
     */
    function use(middleware: AppMiddleware, entity?: string): void {
      if (entity === undefined) {
        globalMiddlewares.push(middleware);
        return;
      }
      const scoped = scopedMiddlewares.get(entity) ?? [];
      scoped.push(middleware);
      scopedMiddlewares.set(entity, scoped);
    }

    assertOneOwnerPerKey(fronds, options.remotes);

    // Every entity of every frond, by name — so a fact can be validated where it LANDS, and
    // so a `reads:` clause can name a neighbour's.
    const entityByName = fronds.schemas();
    // The line is core's, so its SHAPE is too: a destination that declares only a handler
    // would otherwise be handed a line with no `at` — the announcement stamps `created()`
    // off the shape, and the strict judge refuses what it did not stamp. Measured on
    // `demos/observability`, where the ring held 11 calls and 0 lines.
    if (!entityByName.has(LOG_LINE)) entityByName.set(LOG_LINE, LogLine);
    // Which frond holds an entity — what turns "a member is remote" into a refusal that
    // names the frond rather than the entity, since `remotes:` is declared per frond.
    const frondOf = new Map(fronds.flatMap((f) => f.entities.map((e) => [e.name, f.name] as const)));
    // Its own writer, which does NOT announce: this is what carries a fact, and a line
    // about carrying one would come back here. See `LoggerOptions.carries`.
    const emissions = new Emissions(
      fronds, entityByName, container,
      // No carry: this is what CARRIES a fact, and a line about carrying one comes back.
      new Logger('boot:app'),
      options.onEmit,
    );
    /** Canonical operation tables, indexed by the same audience key as their facades. */
    const effectiveByKey = new Map<string, EffectiveOperationsMap>();

    const contractsOf = (operations: EffectiveOperationsMap): OperationsMap => new Map(
      [...operations].map(([name, operation]) => [name, operation as OperationContract] as const),
    );

    // Every port an implementation was bound to, so a `ports:` entry that named none
    // can say so rather than look obeyed.
    const boundPorts = new Set<string>();

    // Register frond scopes
    // What every frond is installed into, and reads while it is: one container, one route
    // table, one emission list — so what a frond serves is there for the next one to find.
    // Read across EVERY frond, unlike a port: a seam's realization is the process's — one
    // storage factory for all of them — so what stands in front of it is too. Read before
    // the first install, because the first frond's storages already go through it.
    const seams = seamChains(fronds.flatMap((frond) => frond.providers), options.ports);
    for (const [seam, links] of seams) {
      boundPorts.add(seam);
      log.debug(`seam ${seam} → ${links.map((one) => one.ctor.name).join(' → ')} → the realization`);
    }

    const assembly: Assembly = {
      container, routeRegistry, emissions, dispatcher, localDispatcher, effectiveByKey,
      boundPorts, operationModel, entityByName, frondOf, contractsOf, getMiddlewares, use,
      seams, log, options,
    };
    for (const frond of fronds) await installFrond(frond, assembly);

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

    // Which doors carry a line, read from who SUBSCRIBED — so a third party's destination
    // is left alone by the two middlewares that observe every operation.
    for (const door of emissions.doorsFor(LOG_LINE)) {
      CARRIES_LINE.add(door.replace(/Handler$/, '').replace(/^./, (c) => c.toLowerCase()));
      CARRIES_LINE.add(door);
    }

    /** The last resort, held by the container so every resolution path shares it. */
    container.setFallback?.((name) => {
      if (!remoteRouter) return undefined;
      if (!name.endsWith('Handler') || name.includes(':')) return undefined;
      // Façade-shaped stand-in; routing happens lazily at the first call. Through
      // `lowerFirst` because a DEPENDENCY names the type as written — `ProductHandler`,
      // PascalCase — while a card declares `product`, so the raw strip asked the router for
      // 'Product' and every by-type dependency on a remote handler answered NOT_FOUND.
      return facadeOperations(
        dispatcher,
        lowerFirst(name.replace(/Handler$/, '')),
      );
    });


    /** Stop taking calls, and resolve once the ones already running are done. */
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

    /** Said once per pair, so a door that registers in a loop says it once. */
    const saidAbsent = new Set<string>();

    /**
     * A surface is declared in the frond that serves it. When that frond runs in another
     * process, this one never asked for its doors, and answering 'no' is the only thing a
     * synchronous rule can do — so it says so rather than registering nothing in silence.
     */
    const sayNoSurfaceAcross = (entity: string, surface: string): void => {
      if (!remoteRouter || saidAbsent.has(`${surface}:${entity}`)) return;
      saidAbsent.add(`${surface}:${entity}`);
      log.warn(
        `surface '${surface}' serves nothing for '${entity}' — the frond that declares it runs `
        + 'elsewhere, and a remote is asked for its doors at the first call, not at boot. '
        + 'The default door answers.',
      );
    };

    /** THE membership rule, stated once — every projection reads this and nothing else. */
    const facadeFor = (entity: string, surface?: string): Record<string, Function> | undefined => {
      if (!surface) return facadeAt(facadeKeyOf(entity), true);

      const own = facadeAt(facadeKeyOf(entity, surface), false);
      const owner = fronds.owner(entity);
      if (!owner) {
        sayNoSurfaceAcross(entity, surface);
        return own;
      }

      const declared = owner.surfaces?.[surface];
      if (!declared) return own;
      if (!declared.some((n) => n.toLowerCase() === entity.toLowerCase())) return undefined;
      if (own) return own;

      const fallback = facadeAt(facadeKeyOf(entity), false);
      return fallback
        ? facadeOperations(
            localDispatcher,
            entity,
            routeRegistry.operationNames(entity, surface),
            surface,
          )
        : undefined;
    };

    if (remoteRouter) {
      const remoteFacades = new Map<string, Record<string, Function>>();
      routeRegistry.addResolver(remoteRoutes((entity) => {
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
     * The storage an entity is backed by — the dual of `facadeFor`, which serves its client-facing
     * door.
     */
    const storageFor = (entity: string): unknown | undefined => {
      const owner = fronds.owner(entity);
      if (!owner) return undefined;

      const key = storageKeyOf(entity);
      try {
        return container.resolve<Container>(`frond:${owner.name}`).resolve(key);
      } catch {
        return undefined;
      }
    };

    /** The presenter of an entity, resolved through its owning frond's scope. */
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
      storageFor,
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
        return typeof args[0] === 'string'
          ? use(args[1] as AppMiddleware, args[0])
          : use(args[0] as AppMiddleware);
      },
      auth: authRuntime,
    };

    // The card is an rpc op like any other, so one registry answers and one refusal names
    // what is served. A package's op is declared the same way, from outside.
    app.serveRpc('discover', (_invocation, surface) => identityCardOf(app, surface));

    // The last thing the boot does, and the first thing a release undoes. An extension may
    // await here — which is what a provider needing to OPEN something could never do.
    built = app;
    await appLifecycle.up(app);

    // The boot's own lines, and every line after them. Held until here because a boot
    // writes most of what a process logs and writes it before any door exists — so the
    // lines that say what this app is made of are the ones a destination would miss.
    // `LogLine` is core's for this reason: naming it costs no optional package.
    //
    // AFTER the ascent, because handing them over RESOLVES the destination, and what a
    // destination an extension brought depends on is registered by that same extension's
    // `up`: `calls()` registers `LogRing` and `ErrorRing` there, and `KeepHandler` asks for
    // both. Resolved before the ascent, every held line died on `'LogRing' is not
    // registered` — measured on `demos/observability`.
    if (emissions.listensTo().includes(LOG_LINE)) {
      const emit = container.resolve<Emit<LogLine>>(emitKeyOf(LogLine.name));
      // `at` is the record's own epoch, and the entity says `created()` — so the line
      // keeps WHEN IT WAS WRITTEN rather than when it was handed over, which for a held
      // boot line is a different moment.
      stopAnnouncing = carry.to(({ at, ...line }: LogRecord) => void emit({ ...line, at: new Date(at) }));
    } else {
      // No destination in this app: the console had them, and holding more would grow.
      carry.forget();
    }

    return app;
  } catch (cause) {
    // The caller cannot release what a failed boot took: it handed `onDispose` over before
    // this call and never receives the app that would carry it back. Whoever opened a
    // connection to give us would otherwise leak it on every refusal — a source, a scan
    // that threw, a port bound twice, and not only an extension that refused to rise.
    try {
      await release();
    } catch (refused) {
      throw new AggregateError(
        [cause, ...(refused instanceof AggregateError ? refused.errors : [refused])],
        `The boot failed and could not release everything it had taken: ${(cause as Error)?.message ?? String(cause)}`,
      );
    }
    throw cause;
  }
}