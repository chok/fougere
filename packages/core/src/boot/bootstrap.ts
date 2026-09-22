import { createContainer, type Container } from '@fougere/container';
import { lowerFirst, type SchemaView } from '@fougere/schema';

import type { HandlerEntry } from '../descriptor/HandlerEntry.js';
import type { PresenterEntry } from '../descriptor/PresenterEntry.js';
import { hostedBy } from './hosted.js';
import { nestingOf, parentsFirst } from './nesting.js';
import type { Fronds } from '../descriptor/Fronds.js';
import { installFrond, type Assembly } from './install.js';
import { dependentsOf, releasing, unfinishable, unheldAmong, unpaired } from './relations.js';
import { release as releaseRow } from '../dispatch/Release.js';
import type { Hosting } from './Hosting.js';
import { peerOver } from './peerOver.js';
import { JOURNAL, type Journal } from '../dispatch/Journal.js';
import type { RelationCheck } from '../dispatch/RelationCheck.js';
import { refusalOf, type Diagnostic } from '../diagnostic.js';
import type { App } from './App.js';
import type { Extension } from './Extension.js';
import type { CreateAppOptions } from './CreateAppOptions.js';
import type { AppMiddleware } from '../wire/AppMiddleware.js';
import { Carry } from '../builtin/Carry.js';
import { Logger } from '../builtin/Logger.js';
import type { LogRecord } from '../builtin/LogRecord.js';
import LogLine, { CARRIES_LINE } from '../builtin/LogLine.js';
import { emitKeyOf, type Emit } from '../wire/Emit.js';

import { Config } from '../builtin/config.js';
import { createRemoteRouter, createRemoteFacade, type RemoteRouter } from './remote.js';
import type { Peer } from './Peer.js';

import { Emissions } from './Emissions.js';

import type { OperationContract } from '../wire/OperationContract.js';
import type { OperationsMap } from '../wire/OperationsMap.js';
import { resolveEffectiveOperations, type EffectiveOperationModel } from '../EffectiveOperationModel.js';
import { type EffectiveOperationsMap } from '../EffectiveOperationsMap.js';

import { InFlight } from '../dispatch/InFlight.js';
import { RPC_ENTITY } from '../wire/RpcAnswer.js';
import { Invocation } from '../wire/Invocation.js';
import { addressOf, facadeKeyOf, isFacadeKey } from '../wire/Facade.js';
import { identityCardOf } from './card.js';
import { AppLifecycle, migrating } from './AppLifecycle.js';
import { seeding } from './seed.js';

import { storageKeyOf, type Storage } from '../storage/Storage.js';

import { presenterKeyOf } from '../prefab/presenter.js';

import { RouteAddress } from '../wire/RouteAddress.js';
import { DispatchLifecycle } from '../dispatch/DispatchLifecycle.js';
import { Dispatcher } from '../dispatch/Dispatcher.js';
import { LocalRoutePolicy } from '../dispatch/LocalRoutePolicy.js';

import { OperationRoute } from '../dispatch/OperationRoute.js';
import { remoteRoutes } from '../dispatch/remoteRoutes.js';
import { RouteRegistry } from '../dispatch/RouteRegistry.js';
import { facadeOperations } from '../entry/facade.js';

const LOG_LINE = lowerFirst(LogLine.name);

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
  // An app that states nothing AND scans nothing is a mistake — unless an extension brings
  // fronds of its own. Refused here and not in `hostedBy`, which is handed the frond sources
  // and cannot see the rest of the app. The condition is the KEYS, not the count: a scan that
  // found nothing is an ordinary answer.
  if (!options.fronds && !options.scan && brought.length === 0) {
    throw new Error(
      'createApp needs `fronds:` (what this app states) or `scan:` (what a scanner found). '
      + 'Neither was given, and nothing else declares entities of its own.\n'
      + '    createApp({ fronds: [blog] })\n'
      + '    createApp({ scan: await scanProject(root) })',
    );
  }

  const { under, refused } = nestingOf(options.under, fronds, options.remotes, options.narrowed);
  const refusal = refusalOf(refused, 'thing(s) the frond tree does not allow');
  if (refusal) throw refusal;

  for (const frond of fronds) {
    const parent = under.get(frond.name);
    if (parent !== undefined) frond.extends = parent;
  }
  const ordered = parentsFirst(fronds, under);

  const operationModel = resolveEffectiveOperations(ordered, {
    diagnostics,
    remotes: options.remotes,
    adapters: options.adapters,
  });
  const scanMs = (performance.now() - scanStart).toFixed(0);
  log.info(`read ${ordered.length} frond(s) in ${scanMs}ms`
    + (diagnostics.length ? ` — ${diagnostics.length} thing(s) the scan could not do` : ''));

  /** Say what could not be read, at the one line everyone already watches. */
  for (const d of diagnostics.filter((one) => one.severity === 'blocking')) log.error(`[${d.code}] ${d.message}`, d.cause);
  for (const d of diagnostics) if (d.severity === 'warning') log.warn(`[${d.code}] ${d.message}`);

  /** An ambiguous convention is not a partial scan. */
  const unresolved = refusalOf(operationModel.resolutionDiagnostics, 'unresolved operation contract(s)');
  if (unresolved) throw unresolved;

  return { fronds: ordered, operationModel };
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
  storageFor: (entity: string) => Storage | undefined,
): void {
  app.serveRpc('discover', (_invocation, surface) => identityCardOf(app, surface));

  app.serveRpc('holds', async (invocation) => {
    const named = String(invocation.params.entity);
    const keys = (invocation.params.keys ?? []) as readonly unknown[];
    const rows = storageFor(named);
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

/**
 * What the frond owning an entity registered under `key` — asked with `has`, so a constructor
 * that throws is said rather than read as an absence. A remote frond registers no scope here.
 */
function ownedBy<T>(fronds: Fronds, container: Container, entity: string, key: string): T | undefined {
  const owner = fronds.owner(entity);
  const scopeKey = `frond:${owner?.name}`;
  if (!owner || !container.has(scopeKey)) return undefined;

  const scope = container.resolve<Container>(scopeKey);

  return scope.has(key) ? scope.resolve<T>(key) : undefined;
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
    [],
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
  remoteRouter: RemoteRouter | undefined;
  entityByName: Map<string, SchemaView>;
  frondOf: Map<string, string>;
  storageOf: (entity: string) => Storage | undefined;
}

function hostingFor(
  { fronds, container, options, remoteRouter, entityByName, frondOf, storageOf }: Hosted,
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
      ? Object.values(options.remotes ?? {}).map((url) => peerOver(options.remoteTransport!(url)))
      : []),
    peerOf: (entity) => (remoteRouter ? peerBehind(entity, remoteRouter) : undefined),
  };

  return { hosting, journalOf };
}

/** What the readings below are built from — every one of them answers about a SERVED entity. */
interface Serving {
  container: Container;
  fronds: Fronds;
  remoteRouter: RemoteRouter | undefined;
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
function readings(
  { container, fronds, remoteRouter, localDispatcher, routeRegistry, effectiveByKey, log }: Serving,
): Pick<App, 'resolve' | 'schemaFor' | 'facadeFor' | 'operationsFor' | 'presenterFor'> {
  const resolve = <T>(name: string): T => {
    try {
      return container.resolve<T>(name);
    } catch (err) {
      if (isFacadeKey(name) && !remoteRouter) throw new Error(notLoaded(addressOf(name)));
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
    if (!fronds.owner(entity)) {
      sayNoSurfaceAcross(entity, surface);

      return own;
    }

    const admitted = fronds.admits(surface, entity);
    if (admitted === false) return undefined;
    if (own || admitted === undefined) return own;

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

  /** The terms beside a facade, read through the same `admits`. */
  const operationsFor = (entity: string, surface?: string): EffectiveOperationsMap | undefined => {
    if (!surface) return effectiveByKey.get(facadeKeyOf(entity));

    const own = effectiveByKey.get(facadeKeyOf(entity, surface));
    const admitted = fronds.admits(surface, entity);
    if (admitted === false) return undefined;

    return admitted ? (own ?? effectiveByKey.get(facadeKeyOf(entity))) : own;
  };

  const presenterFor = (entity: string): unknown | undefined => ownedBy(fronds, container, entity, presenterKeyOf(entity));

  return { resolve, schemaFor, facadeFor, operationsFor, presenterFor };
}

/**
 * Every level told to close even when one refuses, the refusals leaving together — the rule
 * `Lifecycle.down` applies inside its list, applied across the levels. An extension's refusals
 * are already an `AggregateError`, and are flattened into the one list.
 */
async function closeAll(levels: readonly (() => unknown)[]): Promise<void> {
  const refused: unknown[] = [];
  for (const level of levels) {
    try {
      await level();
    } catch (error) {
      if (error instanceof AggregateError) refused.push(...error.errors);
      else refused.push(error);
    }
  }

  if (refused.length > 0) {
    throw new AggregateError(refused, `${refused.length} refusal(s) while releasing the app`);
  }
}

/**
 * Registered under the class name, for type-based DI. A logger holds no level — it reads
 * `setLogLevel`'s at each line — and a frond declaring `class X extends Logger` takes the key.
 */
function registerBuiltins(container: Container, carry: Carry): void {
  container.registerValue('Logger', new Logger('app', { carry }));
  container.register('Config', Config, { lifetime: 'singleton' });
}

/** `remotes:` IS the topology statement: the frond's code may sit here, it runs elsewhere. */
function remoteRouterOf(options: CreateAppOptions): RemoteRouter | undefined {
  const declared = Object.entries(options.remotes ?? {});
  if (declared.length === 0) return undefined;

  if (!options.remoteTransport) {
    throw new Error(
      'createApp: `remotes` is declared but `remoteTransport` is missing — pass one (e.g. from @fougere/transport-http).',
    );
  }

  return createRemoteRouter(Object.fromEntries(declared), options.remoteTransport);
}

/** Every check of a phase, said at once — a boot that stops at the first shows the next after a restart. */
function refuseWhatDoesNotHold(refused: Diagnostic[]): void {
  const refusal = refusalOf(refused, 'declaration(s) that do not hold');
  if (refusal) throw refusal;
}

/**
 * A `ports:` key no port matched reads as a choice that was made. Said once every frond is
 * installed: the entry is app-wide, and no single frond can tell a typo from a neighbour's port.
 */
function warnAboutUnboundPorts(options: CreateAppOptions, boundPorts: Set<string>, log: Logger): void {
  const unbound = Object.keys(options.ports ?? {}).filter((port) => !boundPorts.has(port));
  if (unbound.length === 0) return;

  log.warn(
    `[ports] ${unbound.join(', ')} — named in fougere.config.ts, but no scanned class extends `
    + 'them, so nothing was chosen. Check the spelling, or drop the entry.',
  );
}

/** Read from who SUBSCRIBED, so a third party's destination is left alone by the two middlewares that observe every operation. */
function markLineCarriers(emissions: Emissions): void {
  for (const facade of emissions.facadesFor(LOG_LINE)) {
    CARRIES_LINE.add(addressOf(facade));
    CARRIES_LINE.add(facade);
  }
}

/**
 * A handler another process serves: a stand-in for whoever asks for it by type, and a route for
 * whoever calls it. A dependency names the type as written — `ProductHandler` — while a card
 * declares `product`.
 */
function answerRemotes(
  { container, routeRegistry, dispatcher, getMiddlewares }: Pick<Assembly, 'container' | 'routeRegistry' | 'dispatcher' | 'getMiddlewares'>,
  remoteRouter: RemoteRouter,
): void {
  container.setFallback((name) => (isFacadeKey(name) ? facadeOperations(dispatcher, addressOf(name)) : undefined));

  const remoteFacades = new Map<string, Record<string, Function>>();
  routeRegistry.addResolver(remoteRoutes((entity) => {
    const known = remoteFacades.get(entity);
    if (known) return known;
    const facade = createRemoteFacade(entity, remoteRouter, getMiddlewares);
    remoteFacades.set(entity, facade);

    return facade;
  }));
}

/** Refused rather than replaced: two declarations of one name would make the answer depend on wiring order. */
function serveRpcOn(routeRegistry: RouteRegistry): App['serveRpc'] {
  return (op, answer) => {
    const address = new RouteAddress({ entity: 'rpc', operation: op });
    if (routeRegistry.find(address)) {
      throw new Error(
        `[claim] rpc operation '${op}' is already served; a second declaration would depend on wiring order.\n`
        + '  Two extensions declare it — keep one out of `extensions:`.',
      );
    }

    routeRegistry.register(new OperationRoute('system', address, (call) => answer(call.invocation, call.address.surface)));
  };
}

/** A frond's extension travels with its code, so it mounts on whichever process serves that frond. */
function frondExtensions(fronds: Fronds): Extension[] {
  return fronds.flatMap((frond) => (frond.extensions ?? []).map((one) => ({ name: one.name, ...one.extension })));
}

/**
 * The boot's held lines, and every line after them, handed to the app's destinations — or let go
 * when it has none. After the ascent, because handing them over resolves the destination, and what
 * an extension's destination depends on is registered by that extension's `up`: resolved before,
 * every held line died on `'LogRing' is not registered` (`demos/observability`). A line keeps
 * `at`, when it was WRITTEN, which for a held boot line is not when it is handed over.
 */
function announceLines(emissions: Emissions, container: Container, carry: Carry): (() => void) | undefined {
  if (!emissions.listensTo().includes(LOG_LINE)) {
    carry.forget();

    return undefined;
  }

  const emit = container.resolve<Emit<LogLine>>(emitKeyOf(LogLine.name));

  return carry.to(({ at, ...line }: LogRecord) => void emit({ ...line, at: new Date(at) }));
}

/** Bootstrap a fougere application. */
export async function createApp(options: CreateAppOptions): Promise<App> {
  const container = (options.createContainer ?? createContainer)();
  // Tables, then rows, then whatever the host took on — the order is not a host's to choose.
  const appLifecycle = new AppLifecycle().add(migrating(options.migrate), seeding(), ...(options.extensions ?? []));
  const carry = new Carry();
  let built: App | undefined;
  let stopAnnouncing: (() => void) | undefined;

  /** What an extension took on last, then the container's own, then whoever handed a resource in. */
  const release = async (): Promise<void> => {
    stopAnnouncing?.();
    carry.forget();

    await closeAll([
      ...(built ? [() => appLifecycle.down(built!)] : []),
      () => container.dispose(),
      () => options.onDispose?.(),
    ]);
  };

  try {
    const log = new Logger('boot:app', { carry });
    registerBuiltins(container, carry);
    log.debug('builtins registered (Logger, Config)');

    const { fronds, operationModel } = await readFronds(options, log);
    const remoteRouter = remoteRouterOf(options);
    const { inflight, routeRegistry, dispatchLifecycle, dispatcher, localDispatcher, getMiddlewares, use } =
      dispatching(options, log, fronds, () => journalOf());

    const refused: Diagnostic[] = [];
    keyClaims(fronds, options.remotes, refused);
    refuseWhatDoesNotHold(refused);

    const { entityByName, frondOf, emissions } = whatTheAppKnows(fronds, container, options, refused);
    const effectiveByKey = new Map<string, EffectiveOperationsMap>();
    const storageFor = <T = Record<string, unknown>>(entity: string): Storage<T> | undefined =>
      ownedBy<Storage<T>>(fronds, container, entity, storageKeyOf(entity));
    const { hosting, journalOf } = hostingFor({
      fronds, container, options, remoteRouter, entityByName, frondOf, storageOf: storageFor,
    });

    const relations: RelationCheck[] = [];
    const boundPorts = new Set<string>();
    const assembly: Assembly = {
      container, routeRegistry, emissions, dispatcher, localDispatcher, effectiveByKey,
      boundPorts, refused, relations, hosting, operationModel, entityByName, frondOf, contractsOf,
      getMiddlewares, use, middlewaresOf: new Map(), seamsOf: new Map(), log, options,
    };
    for (const frond of fronds) await installFrond(frond, assembly);

    warnAboutRelations(relations, hosting, log);
    refused.push(...unpaired(fronds.flatMap((frond) => frond.entities), hosting));
    refuseWhatDoesNotHold(refused);
    warnAboutUnboundPorts(options, boundPorts, log);

    // A pipe order and an `Emit<T, A>` are read here, once every facade exists.
    emissions.register();
    refuseWhatDoesNotHold(refused);
    markLineCarriers(emissions);

    if (remoteRouter) answerRemotes(assembly, remoteRouter);

    const { resolve, schemaFor, facadeFor, operationsFor, presenterFor } = readings({
      container, fronds, remoteRouter, localDispatcher, routeRegistry, effectiveByKey, log,
    });

    const app: App = {
      container,
      fronds,
      adapters: options.adapters ?? {},
      // As DECLARED, beside what the runtime observes — the two disagree exactly when something is misconfigured.
      remotes: Object.freeze({ ...options.remotes }),
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
      serveRpc: serveRpcOn(routeRegistry),
      extensions: () => appLifecycle.names(),
      observe: (observer) => dispatchLifecycle.add(observer),
      use(...args: [AppMiddleware] | [string, AppMiddleware]): void {
        return typeof args[0] === 'string'
          ? use(args[1] as AppMiddleware, args[0])
          : use(args[0] as AppMiddleware);
      },
    };

    container.registerValue('Releasing', releasing(hosting));
    serveCoreRpc(app, hosting, storageFor);

    built = app;
    appLifecycle.add(...frondExtensions(fronds));
    await appLifecycle.up(app);
    stopAnnouncing = announceLines(emissions, container, carry);

    return app;
  } catch (cause) {
    // The caller never receives the app that would carry `onDispose` back, so a refused boot
    // releases what it took itself — a source, a scan that threw, a port bound twice.
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

/** The contract every effective operation already is — the façade reads nothing else. */
function contractsOf(operations: EffectiveOperationsMap): OperationsMap {
  return new Map([...operations].map(([name, operation]) => [name, operation as OperationContract] as const));
}
