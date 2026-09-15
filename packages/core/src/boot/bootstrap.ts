import { createContainer, type Container } from '@fougere/container';
import { lowerFirst, type SchemaView } from '@fougere/schema';

import type { HandlerEntry } from '../descriptor/HandlerEntry.js';
import type { PresenterEntry } from '../descriptor/PresenterEntry.js';
import { hostedBy } from './hosted.js';
import type { Fronds } from '../descriptor/Fronds.js';
import { installFrond, type Assembly } from './install.js';
import { dependentsOf, releasing, unfinishable, unheldAmong } from './relations.js';
import { release as releaseRow } from '../dispatch/Release.js';
import type { Hosting } from './Hosting.js';
import { peerOver } from './peerOver.js';
import { JOURNAL, type Journal } from '../dispatch/Journal.js';
import type { RelationCheck } from '../dispatch/RelationCheck.js';
import { refusalOf, type Diagnostic } from '../diagnostic.js';
import type { AuthRuntime } from './AuthRuntime.js';
import type { App } from './App.js';
import type { CreateAppOptions } from './CreateAppOptions.js';
import type { AppMiddleware } from '../wire/AppMiddleware.js';
import { Carry } from '../builtin/Carry.js';
import { Logger } from '../builtin/Logger.js';
import type { LogRecord } from '../builtin/LogRecord.js';
import LogLine, { CARRIES_LINE } from '../builtin/LogLine.js';
import { emitKeyOf, type Emit } from '../wire/Emit.js';

/** The fact the boot announces, spelled once. */
const LOG_LINE = lowerFirst(LogLine.name);
import { Config } from '../builtin/config.js';
import { createRemoteRouter, createRemoteFacade, type RemoteRouter } from './remote.js';
import type { Peer } from './Peer.js';

import { Emissions } from './Emissions.js';

import type { OperationContract } from '../wire/OperationContract.js';
import type { OperationsMap } from '../wire/OperationsMap.js';
import { resolveEffectiveOperations, type EffectiveOperationModel } from '../EffectiveOperationModel.js';
import { type EffectiveOperationsMap } from '../EffectiveOperationsMap.js';

import { InFlight } from '../dispatch/InFlight.js';
// The keys, each read from where its concept is declared — never respelled here.
import { RPC_ENTITY, type RpcAnswer } from '../wire/RpcAnswer.js';
import { Invocation } from '../wire/Invocation.js';
import { facadeKeyOf } from '../wire/Facade.js';
import { identityCardOf } from './card.js';
import { AppLifecycle, migrating } from './AppLifecycle.js';
import { seeding } from './seed.js';

import { storageKeyOf } from '../storage/Storage.js';

import { presenterKeyOf } from '../prefab/presenter.js';

import { RouteAddress } from '../wire/RouteAddress.js';
import { DispatchLifecycle } from '../dispatch/DispatchLifecycle.js';
import { Dispatcher } from '../dispatch/Dispatcher.js';
import { LocalRoutePolicy } from '../dispatch/LocalRoutePolicy.js';

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
function keyClaims(
  fronds: { name: string; handlers: HandlerEntry[]; presenters: PresenterEntry[] }[],
  remotes: Record<string, string> | undefined,
  refused: Diagnostic[],
): void {
  const owner = new Map<string, string>();
  const fileOf = new Map<string, string>();

  const claim = (key: string, frond: string, what: string, filePath: string) => {
    const first = owner.get(key);
    if (first !== undefined && first !== frond) {
      refused.push({
        severity: 'blocking',
        code: 'frond-key-taken',
        filePath,
        frond,
        subject: key,
        message: `'${first}' and '${frond}' both claim the key '${key}'. A ${what} is registered `
          + 'under a key that names no frond, so one would silently replace the other. Rename one '
          + 'of the two classes, or keep one frond out of this process (--fronds). '
          + `'${first}' declares it in ${fileOf.get(key)}.`,
      });

      return;
    }
    owner.set(key, frond);
    fileOf.set(key, filePath);
  };

  for (const frond of fronds) {
    if (remotes && frond.name in remotes) continue;
    for (const handler of frond.handlers) claim(facadeKeyOf(handler.address, handler.surface), frond.name, 'facade', handler.filePath);
    for (const presenter of frond.presenters) claim(presenterKeyOf(presenter.entityName), frond.name, 'presenter', presenter.filePath);
  }
}

/**
 * What this app hosts, and what its operations effectively are.
 *
 * Producing it may read a disk; consuming it never does, which is the whole reason this file
 * names no builtin and a Worker can run what it builds.
 */
async function readFronds(
  options: CreateAppOptions,
  log: Logger,
): Promise<{ fronds: Fronds; operationModel: EffectiveOperationModel }> {
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
      + 'Neither was given, and nothing else declares entities of its own.\n'
      + '    createApp({ fronds: [blog] })\n'
      + '    createApp({ scan: await scanProject(root) })',
    );
  }

  const operationModel = resolveEffectiveOperations(fronds, {
    diagnostics,
    remotes: options.remotes,
    adapters: options.adapters,
  });
  const scanMs = (performance.now() - scanStart).toFixed(0);
  log.info(`read ${fronds.length} frond(s) in ${scanMs}ms`
    + (diagnostics.length ? ` — ${diagnostics.length} thing(s) the scan could not do` : ''));

  /** Say what could not be read, at the one line everyone already watches. */
  for (const d of diagnostics.filter((one) => one.severity === 'blocking')) log.error(`[${d.code}] ${d.message}`, d.cause);
  for (const d of diagnostics) if (d.severity === 'warning') log.warn(`[${d.code}] ${d.message}`);

  /** An ambiguous convention is not a partial scan. */
  const unresolved = refusalOf(operationModel.resolutionDiagnostics, 'unresolved operation contract(s)');
  if (unresolved) throw unresolved;

  return { fronds, operationModel };
}

/**
 * What core answers under `rpc`, in every process, whatever fronds it carries.
 *
 * All four read the STORAGE and never a facade: a facade answers what its handler chose to show,
 * so `PostHandler.list` hiding drafts would hide exactly the row the question exists to find.
 */
function serveCoreRpc(
  app: App,
  hosting: Hosting,
  storageFor: (entity: string) => unknown | undefined,
): void {
  app.serveRpc('discover', (_invocation, surface) => identityCardOf(app, surface));

  app.serveRpc('holds', async (invocation) => {
    const named = String(invocation.params.entity);
    const keys = (invocation.params.keys ?? []) as readonly unknown[];
    const rows = storageFor(named) as { findByKeys(k: readonly string[]): Promise<Map<string, unknown>> } | undefined;
    if (!rows) return { missing: [] };
    const found = await rows.findByKeys(keys.map(String));

    return { missing: keys.filter((key) => !found.has(String(key))) };
  });

  app.serveRpc('dependents', (invocation) => dependentsOf(String(invocation.params.entity), hosting));

  app.serveRpc('release', async (invocation) => {
    await releaseRow(String(invocation.params.entity), invocation.params.key, releasing(hosting),
      (invocation.params.visited ?? []) as readonly string[]);

    return { released: true };
  });
}

/**
 * What no single frond can see about a `ref()`, so it is said once every frond is installed.
 *
 * A target belongs to another frond, and a journal arrives with an extension, which rises last.
 */
function warnAboutRelations(relations: RelationCheck[], hosting: Hosting, log: Logger): void {
  const unfinished = unfinishable(hosting);
  if (unfinished.length > 0) {
    log.warn(
      `[relations] ${unfinished.join(', ')} — declared, and this process keeps nothing on `
      + 'restart: a release interrupted here is not resumed. Install @fougere/workflow, or '
      + 'expect to finish one by hand.',
    );
  }

  const unheld = unheldAmong(relations, hosting);
  if (unheld.length > 0) {
    log.warn(
      `[relations] ${unheld.join(', ')} — declared, and nothing in this process holds them: `
      + 'no foreign key, and the target answers elsewhere. A row may name one that is gone.',
    );
  }
}

/** The process that serves an entity, asked the three questions a release travels on. */
function peerBehind(entity: string, router: RemoteRouter): Peer {
  const ask = async (op: string, params: Record<string, unknown>): Promise<unknown> =>
    (await router.route(entity)).transport(
      { entity: RPC_ENTITY, op },
      { ...Invocation.empty, params: params as never },
    );

  return {
    dependents: async (named) => await ask('dependents', { entity: named }) as never,
    missing: async (named, keys) =>
      (await ask('holds', { entity: named, keys }) as { missing: readonly unknown[] }).missing,
    release: async (named, key) => { await ask('release', { entity: named, key }); },
  };
}

/** Close the door, and answer once the calls already running are done. */
async function drainCalls(inflight: InFlight, timeoutMs?: number): Promise<void> {
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
}

/** What a call goes through in this process, before any frond is installed into it. */
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
  getMiddlewares(entity: string): AppMiddleware[];
  /** The one place a middleware is taken on — `App.use` is its late form, a frond's directory its early one. */
  use(middleware: AppMiddleware, entity?: string): void;
}

function dispatching(
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
    options.dispatchObservers,
    (error, event) => log.error(
      `[dispatch-observer] ${event.stage} ${event.call.address.toString()}`,
      error,
    ),
  );

  return {
    inflight,
    routeRegistry,
    dispatchLifecycle,
    // Resolved at the call and never here: a journal is a provider of a brought frond, and the
    // extension that registers it rises long after this line.
    dispatcher: new Dispatcher(routeRegistry, inflight, dispatchLifecycle, undefined, journalOf),
    localDispatcher: new Dispatcher(
      routeRegistry,
      inflight,
      dispatchLifecycle,
      new LocalRoutePolicy((surface) => fronds.servedNames(surface)),
      journalOf,
    ),
    getMiddlewares: (entity) => [...globalMiddlewares, ...(scopedMiddlewares.get(entity) ?? [])],
    use(middleware, entity) {
      if (entity === undefined) {
        globalMiddlewares.push(middleware);

        return;
      }

      scopedMiddlewares.set(entity, [...(scopedMiddlewares.get(entity) ?? []), middleware]);
    },
  };
}

/** Every entity of every frond, who holds it, and the door a fact goes through. */
function whatTheAppKnows(
  fronds: Fronds,
  container: Container,
  options: CreateAppOptions,
  refused: Diagnostic[],
): { entityByName: Map<string, SchemaView>; frondOf: Map<string, string>; emissions: Emissions } {
  // By name, so a fact can be validated where it LANDS and a `reads:` clause can name a
  // neighbour's entity.
  const entityByName = fronds.schemas();
  // The line is core's, so its SHAPE is too: a destination that declares only a handler would
  // otherwise be handed a line with no `at` — the announcement stamps `created()` off the shape,
  // and the strict judge refuses what it did not stamp. Measured on `demos/observability`, where
  // the ring held 11 calls and 0 lines.
  if (!entityByName.has(LOG_LINE)) entityByName.set(LOG_LINE, LogLine);

  return {
    entityByName,
    // What turns "a member is remote" into a refusal that names the FROND rather than the
    // entity, since `remotes:` is declared per frond.
    frondOf: new Map(fronds.flatMap((one) => one.entities.map((entity) => [entity.name, one.name] as const))),
    emissions: new Emissions(
      fronds, entityByName, container,
      // No carry: this is what CARRIES a fact, and a line about carrying one comes back here.
      new Logger('boot:app'),
      refused,
      options.onEmit,
    ),
  };
}

/** What every check of the boot asks about where a row lives, and who else might hold one. */
interface Hosted {
  fronds: Fronds;
  container: Container;
  options: CreateAppOptions;
  declaredRemotes: [string, string][];
  remoteRouter: RemoteRouter | undefined;
  entityByName: Map<string, SchemaView>;
  frondOf: Map<string, string>;
  storageOf: (entity: string) => unknown | undefined;
}

function hostingFor(
  { fronds, container, options, declaredRemotes, remoteRouter, entityByName, frondOf, storageOf }: Hosted,
): { hosting: Hosting; journalOf: () => Journal | undefined } {
  // What carries a release writes none: an instrumentation frond's own rows are kept while a
  // release happens, and journalling them would begin one inside the one being written down.
  const carriesRelease = new Set(
    fronds.filter((one) => one.brought).flatMap((one) => one.entities.map((entity) => entity.name)),
  );

  /**
   * The journal a package registered, found where its own frond put it — a provider lands in its
   * frond's scope, and the app container sees none of them. Resolved per call and never at boot:
   * the package that registers it rises in the ascent, long after this answer is built.
   */
  const journalOf = (): Journal | undefined => {
    for (const frond of fronds) {
      if (!frond.brought) continue;
      const scope = container.resolve<Container>(`frond:${frond.name}`);
      if (scope.has(JOURNAL)) return scope.resolve<Journal>(JOURNAL);
    }

    return undefined;
  };

  const hosting: Hosting = {
    hostedHere: (entity) => !(options.remotes && (frondOf.get(entity) ?? '') in options.remotes),
    sourceOf: (name) => options.sourceOf?.(name) ?? 'db',
    enforces: (source, constraint) => options.enforces?.(source, constraint) ?? false,
    storageOf,
    entities: () => entityByName,
    journal: (entity) => (carriesRelease.has(entity) ? undefined : journalOf()),
    // Built from `remotes:` itself and not from the router: the router indexes by ENTITY, read
    // off a card, while the question here is asked of a PROCESS about rows it may be alone in
    // knowing about. Nothing is cached — a peer that was down at boot answers the next call.
    peers: () => (options.remoteTransport
      ? declaredRemotes.map(([, url]) => peerOver(options.remoteTransport!(url)))
      : []),
    peerOf: (entity) => (remoteRouter ? peerBehind(entity, remoteRouter) : undefined),
  };

  return { hosting, journalOf };
}

/** Bootstrap a fougere application. */
export async function createApp(options: CreateAppOptions): Promise<App> {
  const container = (options.createContainer ?? createContainer)();

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

    const { fronds, operationModel } = await readFronds(options, log);

    // Auth runtime — built once from the lazy AuthConfig produced by a provider factory
    // (e.g. betterAuth({...})) in fougere.config.ts. The provider receives our db +
    // storageFactory so all auth writes flow through Storage.
    let authRuntime: AuthRuntime | undefined;
    if (options.auth) {
      if (!options.storageFactory) {
        throw new Error('createApp: `auth` is set but `storageFactory` is missing — auth providers need it to back their adapter. Pass one through CreateAppOptions.storageFactory.');
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

    const { inflight, routeRegistry, dispatchLifecycle, dispatcher, localDispatcher, getMiddlewares, use } =
      dispatching(options, log, fronds, () => journalOf());

    /** What every check of this boot writes into — refused together, once they have all run. */
    const refused: Diagnostic[] = [];
    const relations: RelationCheck[] = [];
    keyClaims(fronds, options.remotes, refused);
    // Said before anything is installed: a key claimed twice makes every later error worse —
    // the route registry collides first, and names a route instead of the two fronds.
    const claimed = refusalOf(refused, 'declaration(s) that do not hold');
    if (claimed) throw claimed;

    const { entityByName, frondOf, emissions } = whatTheAppKnows(fronds, container, options, refused);

    /** Canonical operation tables, indexed by the same audience key as their facades. */
    const effectiveByKey = new Map<string, EffectiveOperationsMap>();

    const contractsOf = (operations: EffectiveOperationsMap): OperationsMap => new Map(
      [...operations].map(([name, operation]) => [name, operation as OperationContract] as const),
    );

    /**
     * The storage an entity is backed by — the dual of `facadeFor`, which serves its client-facing
     * facade.
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

    // What carries a release writes none: an instrumentation frond's own rows are kept while a
    // release happens, and journalling them would begin one inside the one being written down.
    const { hosting, journalOf } = hostingFor({
      fronds, container, options, declaredRemotes, remoteRouter, entityByName, frondOf, storageOf: storageFor,
    });

    // Every port an implementation was bound to, so a `ports:` entry that named none
    // can say so rather than look obeyed.
    const boundPorts = new Set<string>();

    // Register frond scopes
    // What every frond is installed into, and reads while it is: one container, one route
    // table, one emission list — so what a frond serves is there for the next one to find.
    const assembly: Assembly = {
      container, routeRegistry, emissions, dispatcher, localDispatcher, effectiveByKey,
      boundPorts, refused, relations, hosting, operationModel, entityByName, frondOf, contractsOf,
      getMiddlewares, use, log, options,
    };
    for (const frond of fronds) await installFrond(frond, assembly);

    warnAboutRelations(relations, hosting, log);

    // Every check of the install, said at once — a boot that stops at the first makes the
    // next one visible only after a fix and a restart.
    const bootRefusal = refusalOf(refused, 'declaration(s) that do not hold');
    if (bootRefusal) throw bootRefusal;

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

    // Once every facade exists: what is announced here and what is listened to are both known.
    emissions.register();

    // The third phase: what a fact's links and its answer type state. Said after `register`,
    // which is where a pipe order and an `Emit<T, A>` are read.
    const announced = refusalOf(refused, 'declaration(s) that do not hold');
    if (announced) throw announced;

    // Which facades carry a line, read from who SUBSCRIBED — so a third party's destination
    // is left alone by the two middlewares that observe every operation.
    for (const facade of emissions.facadesFor(LOG_LINE)) {
      CARRIES_LINE.add(facade.replace(/Handler$/, '').replace(/^./, (c) => c.toLowerCase()));
      CARRIES_LINE.add(facade);
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
        // A remote facade that stores nothing publishes ops and no shape. Saying so beats
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

    /** Said once per pair, so a facade that registers in a loop says it once. */
    const saidAbsent = new Set<string>();

    /**
     * A surface is declared in the frond that serves it. When that frond runs in another
     * process, this one never asked for its facades, and answering 'no' is the only thing a
     * synchronous rule can do — so it says so rather than registering nothing in silence.
     */
    const sayNoSurfaceAcross = (entity: string, surface: string): void => {
      if (!remoteRouter || saidAbsent.has(`${surface}:${entity}`)) return;
      saidAbsent.add(`${surface}:${entity}`);
      log.warn(
        `surface '${surface}' serves nothing for '${entity}' — the frond that declares it runs `
        + 'elsewhere, and a remote is asked for its facades at the first call, not at boot. '
        + 'The default facade answers.',
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

    /** The terms beside a facade, with the exact same named-surface fallback rule. */
    const operationsFor = (entity: string, surface?: string): EffectiveOperationsMap | undefined => {
      if (!surface) return effectiveByKey.get(facadeKeyOf(entity));

      const own = effectiveByKey.get(facadeKeyOf(entity, surface));
      const declared = fronds.owner(entity)?.surfaces?.[surface];
      if (!declared) return own;
      return declared.some((name) => name.toLowerCase() === entity.toLowerCase())
        ? (own ?? effectiveByKey.get(facadeKeyOf(entity)))
        : undefined;
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
      // What this app publishes, straight from fougere.config.ts — the facades read it,
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
      drain: (timeoutMs?: number) => drainCalls(inflight, timeoutMs),
      inFlight: () => inflight.count,
      [Symbol.asyncDispose]: release,
      serveRpc(op: string, answer: RpcAnswer): void {
        // Refused rather than replaced: two declarations of one name would make the answer
        // depend on wiring order, and `discover` is in here precisely so it cannot be taken.
        const address = new RouteAddress({ entity: 'rpc', operation: op });
        if (routeRegistry.find(address)) {
          throw new Error(
            `[claim] rpc operation '${op}' is already served; a second declaration would depend on wiring order.\n`
            + '  Two extensions declare it — keep one out of `extensions:`.',
          );
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
    // What a release is, resolved once and registered: a package that drives one asks for it
    // by type, the way every other dependency is asked for.
    container.registerValue('Releasing', releasing(hosting));

    serveCoreRpc(app, hosting, storageFor);

    // The last thing the boot does, and the first thing a release undoes. An extension may
    // await here — which is what a provider needing to OPEN something could never do.
    built = app;

    // What the FRONDS declared, folded in after what the host handed over — a frond's
    // extension is written beside the code it instruments and travels with it, so it mounts
    // on whichever process ends up serving that frond. Added here rather than at the top
    // because the fronds are read below that line, and `up` has not run yet.
    appLifecycle.add(...fronds.flatMap((frond) => (frond.extensions ?? []).map((one) => ({
      name: one.name,
      ...one.extension,
    }))));

    await appLifecycle.up(app);

    // The boot's own lines, and every line after them. Held until here because a boot
    // writes most of what a process logs and writes it before any facade exists — so the
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