import { tablesOf } from '../descriptor/tables.js';
import { createContainer, type Container } from '@fougere/container';
import { resolveConventions } from '../Conventions.js';
import { servedProtocols } from './protocols.js';
import { unregistered } from './unregistered.js';
import { answerAt, type DoorAround } from '../entry/door.js';
import { keeperFronds, keepingOf } from '../module/state/keeping.js';
import { States } from '../module/state/States.js';
import { DoorEvent } from '../dispatch/DoorEvent.js';
import { dependencyCycles } from './dependencyCycles.js';
import { type SchemaView } from '@fougere/schema';

import type { HandlerEntry } from '../descriptor/HandlerEntry.js';
import type { PresenterEntry } from '../descriptor/PresenterEntry.js';
import { hostedBy } from './hosted.js';
import { termRefusals } from './terms.js';
import { nestingOf, parentsFirst } from './nesting.js';
import { valuing } from '../module/value/valuing.js';
import type { Fronds } from '../descriptor/Fronds.js';
import type { FrondDescriptor } from '../descriptor/FrondDescriptor.js';
import { installFrond, type Assembly } from './install.js';
import { releasing, unpaired } from '../module/relation/relations.js';
import { rowHostsFor } from '../module/relation/rowHostsFor.js';
import { serveRelationReadings } from '../module/relation/readings.js';
import { warnAboutRelations } from '../module/relation/warnAboutRelations.js';
import type { RowHosts } from '../module/relation/RowHosts.js';
import type { Journal } from '../wire/Journal.js';
import type { RelationCheck } from '../module/relation/RelationCheck.js';
import { refusalOf, type Diagnostic } from '../diagnostic.js';
import type { App } from './App.js';
import type { Extension } from './Extension.js';
import type { CreateAppOptions } from './CreateAppOptions.js';
import type { AppMiddleware } from '../wire/AppMiddleware.js';
import { LineBuffer } from '../builtin/LineBuffer.js';
import { Logger } from '../builtin/Logger.js';
import { operation, request } from '../slots.js';
import type { LogRecord } from '../builtin/LogRecord.js';
import LogLine, { CARRIES_LINE, LOG_LINE } from '../builtin/LogLine.js';
import { emitKeyOf, listens, type Emit } from '../wire/Emit.js';

import { createRemoteRouter, createRemoteFacade, type RemoteRouter } from './remote.js';

import { Emissions } from '../module/fact/Emissions.js';

import type { OperationContract } from '../wire/OperationContract.js';
import type { OperationsMap } from '../wire/OperationsMap.js';
import { resolveEffectiveOperations, type EffectiveOperationModel } from '../EffectiveOperationModel.js';
import { type EffectiveOperationsMap } from '../EffectiveOperationsMap.js';

import { InFlight } from '../dispatch/InFlight.js';
import { RPC_ADDRESS } from '../wire/RpcAnswer.js';
import { addressOf, facadeKeyOf, isFacadeKey } from '../wire/Facade.js';
import { identityCardOf } from './card.js';
import { AppLifecycle, checking, closeAll } from './AppLifecycle.js';
import { seeding } from './seed.js';
import { presenters } from '../module/presenter/presenters.js';
import { Registry } from '@fougere/registry';
import type { Plugged } from '../wire/Plugged.js';

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
import { Membership, notLoaded, ownedBy } from './Membership.js';

/** Two fronds cannot claim one name — said at boot, because nothing else says it. */
function refuseDuplicateKeys(
  fronds: { name: string; handlers: HandlerEntry[]; presenters: PresenterEntry[] }[],
  remotes: Record<string, string> | undefined,
  refused: Diagnostic[],
): void {
  const owner = new Map<string, string>();
  const fileOf = new Map<string, string>();

  const register = (key: string, frond: string, what: string, filePath: string) => {
    const first = owner.get(key);
    if (first !== undefined && first !== frond) {
      refused.push({
        severity: 'blocking',
        code: 'frond-key-taken',
        filePath,
        frond,
        subject: key,
        message: `The fronds '${first}' and '${frond}' both have a ${what} answering ${key}, the other in ${fileOf.get(key)}. `
          + 'Rename one, or leave one frond out of this process (only:).',
      });

      return;
    }
    owner.set(key, frond);
    fileOf.set(key, filePath);
  };

  for (const frond of fronds) {
    if (remotes && frond.name in remotes) continue;
    for (const handler of frond.handlers) register(facadeKeyOf(handler.address, handler.surface), frond.name, 'handler', handler.filePath);
    for (const presenter of frond.presenters) register(presenterKeyOf(presenter.entityName), frond.name, 'presenter', presenter.filePath);
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
  keeperFronds: readonly FrondDescriptor[],
): Promise<{ fronds: Fronds; operationModel: EffectiveOperationModel }> {
  const scanStart = performance.now();
  // An extension's fronds sit beside the app's own: it is installed like any other, and
  // its handlers resolve at call time — by which point the extension's `up` has put what
  // they ask for in the container.
  // So are the fronds a keeper of `state:` keeps its rows in, brought only where `state:` names it.
  const fromExtensions = [...(options.extensions ?? []).flatMap((extension) => extension?.fronds ?? []), ...keeperFronds]
    .map((frond) => ({ ...frond, fromExtension: true as const }));
  const fronds = hostedBy([...(options.fronds ?? []), ...fromExtensions]);
  const diagnostics: Diagnostic[] = [];
  // An app that states nothing is a mistake — unless an extension brings fronds of its own. The
  // condition is the KEY, not the count: a statement that lists no frond is an ordinary answer.
  if (!options.fronds && fromExtensions.length === 0) {
    throw new Error(
      'createApp needs `fronds:`, the list of fronds this app runs. Pass one:\n'
      + '    createApp({ fronds: [blog] })\n'
      + '    createApp({ ...(await statementOf(root)) })',
    );
  }

  const conventions = resolveConventions(options.conventions);
  const { under, refused } = nestingOf(options.under, fronds, options.remotes, options.narrowed, conventions, (name) => options.values?.sourceOf(name) !== undefined);
  const refusal = refusalOf(refused, 'thing(s) the frond tree does not allow');
  if (refusal) throw refusal;

  for (const frond of fronds) {
    const parent = under.get(frond.name);
    if (parent !== undefined) frond.extends = parent;
  }
  const ordered = parentsFirst(fronds, under);

  for (const term of options.vocabulary ?? []) term.register();
  const termRefusal = refusalOf(termRefusals(ordered, conventions), 'term(s) nothing in this process answers');
  if (termRefusal) throw termRefusal;

  const operationModel = resolveEffectiveOperations(ordered, {
    conventions,
    diagnostics,
    remotes: options.remotes,
    protocols: servedProtocols(options.protocols, ordered),
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
  rowHosts: RowHosts,
  storageFor: (entity: string) => Storage | undefined,
): void {
  app.serveRpc('discover', (_invocation, surface) => identityCardOf(app, surface));
  serveRelationReadings(app.serveRpc, rowHosts, storageFor);
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
  getMiddlewares(address: string): AppMiddleware[];
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
      `[dispatch-observer] ${event.stage} ${event instanceof DoorEvent ? event.request.door : event.call.address.toString()}`,
      error,
    ),
    request.current,
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

/** Every entity of every frond, who holds it, and the door a fact goes through. */
function whatTheAppKnows(
  fronds: Fronds,
  container: Container,
  options: CreateAppOptions,
  refused: Diagnostic[],
  remoteRouter: RemoteRouter | undefined,
): { entityByName: Map<string, SchemaView>; frondOf: Map<string, string>; emissions: Emissions } {
  // By name, so a fact can be validated where it LANDS and a `reads:` clause can name a
  // neighbour's entity.
  const { tables: entityByName, contradictions } = tablesOf(fronds);
  for (const { entity: name, field, fronds: [one, other], filePath } of contradictions) {
    refused.push({
      severity: 'blocking',
      code: 'table-contradicted',
      subject: `${name}.${field}`,
      filePath,
      message: `The fronds '${one}' and '${other}' both declare ${name}.${field}, differently. They are two views of one `
        + `table, and one column has one shape: declare ${field} the same way in both, or leave it out of one.`,
    });
  }
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
      remoteRouter,
    ),
  };
}

/**
 * Registered under the class name, for type-based DI. A logger holds no level — it reads
 * `setLogLevel`'s at each line — and a frond declaring `class X extends Logger` takes the key.
 */
function registerBuiltins(container: Container, lineBuffer: LineBuffer): void {
  container.registerValue('Logger', new Logger('app', { lineBuffer, during: operation.current }));
}

/** `remotes:` IS the topology statement: the frond's code may sit here, it runs elsewhere. */
function remoteRouterOf(options: CreateAppOptions): RemoteRouter | undefined {
  const declared = Object.entries(options.remotes ?? {});
  if (declared.length === 0) return undefined;

  if (!options.remoteTransport) {
    throw new Error(
      'createApp: fronds have an address, but no remoteTransport is given. Pass one, e.g. from @fougere/transport-http.',
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
 * A frond that fails to install after a check already refused it is answered by that check, with
 * the fronds after it — so the refusal still names every frond, not the first.
 */
async function installing(frond: FrondDescriptor, assembly: Assembly): Promise<void> {
  try {
    await installFrond(frond, assembly);
  } catch (failure) {
    if (!assembly.refused.some((one) => one.severity === 'blocking')) throw failure;
  }
}

/**
 * A `ports:` key no port matched reads as a choice that was made. Said once every frond is
 * installed: the entry is app-wide, and no single frond can tell a typo from a neighbour's port.
 */
function warnAboutUnboundPorts(options: CreateAppOptions, boundPorts: Set<string>, log: Logger): void {
  const unbound = Object.keys(options.ports ?? {}).filter((port) => !boundPorts.has(port));
  if (unbound.length === 0) return;

  log.warn(
    `[ports] ${unbound.join(', ')}: in fougere.config.ts, but no class extends ${unbound.length === 1 ? 'it' : 'them'}. `
    + 'Check the spelling, or remove the entry.',
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
  { container, routeRegistry, dispatcher, getMiddlewares, options, state }: Pick<Assembly, 'container' | 'routeRegistry' | 'dispatcher' | 'getMiddlewares' | 'options' | 'state'>,
  remoteRouter: RemoteRouter,
  fronds: Fronds,
): (name: string) => boolean {
  // Only for what another process may serve: an entity a frond hosts HERE and gives no handler
  // is served by nobody, and a stand-in for it had GraphQL project an entity with no operation.
  const servedRemotely = (address: string): boolean => {
    const owner = fronds.owner(address);

    return owner === undefined || owner.name in (options.remotes ?? {});
  };
  const facadeServedRemotely = (name: string): boolean => isFacadeKey(name) && servedRemotely(addressOf(name));
  container.setFallback((name) => (facadeServedRemotely(name) ? facadeOperations(dispatcher, addressOf(name)) : undefined));

  const remoteFacades = new Map<string, Record<string, Function>>();
  routeRegistry.addResolver(remoteRoutes((address) => {
    const known = remoteFacades.get(address);
    if (known) return known;
    const facade = createRemoteFacade(address, remoteRouter, getMiddlewares, state);
    remoteFacades.set(address, facade);

    return facade;
  }));

  return facadeServedRemotely;
}

/** Refused rather than replaced: two declarations of one name would make the answer depend on wiring order. */
function serveRpcOn(routeRegistry: RouteRegistry): App['serveRpc'] {
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
function announceLines(emissions: Emissions, container: Container, lineBuffer: LineBuffer): (() => void) | undefined {
  if (!emissions.listensTo().includes(LOG_LINE)) {
    lineBuffer.drop();

    return undefined;
  }

  const emit = container.resolve<Emit<LogLine>>(emitKeyOf(LogLine.name));

  return lineBuffer.to(({ at, ...line }: LogRecord) => void emit({ ...line, at: new Date(at) }));
}

/** Bootstrap a fougere application. */
export async function createApp(options: CreateAppOptions): Promise<App> {
  const container = (options.createContainer ?? createContainer)();
  // The schema checked, then rows, then whatever the host took on — the order is not a host's to choose.
  const appLifecycle = new AppLifecycle().add(checking(options.pending), valuing(options.values), seeding(), presenters(), ...(options.extensions ?? []));
  const lineBuffer = new LineBuffer();
  let createdApp: App | undefined;
  let stopAnnouncing: (() => void) | undefined;

  /** What an extension took on last, then the container's own, then whoever handed a resource in. */
  const release = async (): Promise<void> => {
    stopAnnouncing?.();
    lineBuffer.drop();

    await closeAll([
      ...(createdApp ? [() => appLifecycle.down(createdApp!)] : []),
      () => container.dispose(),
      () => options.onDispose?.(),
    ], 'refusal(s) while releasing the app');
  };

  try {
    const log = new Logger('boot:app', { lineBuffer });
    registerBuiltins(container, lineBuffer);
    log.debug('builtins registered (Logger)');

    const declaredState = States.declared(options.state);
    const { fronds, operationModel } = await readFronds(options, log, keeperFronds(declaredState));
    appLifecycle.add(...frondExtensions(fronds));
    const remoteRouter = remoteRouterOf(options);
    const { inflight, routeRegistry, dispatchLifecycle, dispatcher, localDispatcher, getMiddlewares, use } =
      dispatching(options, log, fronds, () => journalOf());

    const refused: Diagnostic[] = [];
    refuseDuplicateKeys(fronds, options.remotes, refused);
    refuseWhatDoesNotHold(refused);

    const { entityByName, frondOf, emissions } = whatTheAppKnows(fronds, container, options, refused, remoteRouter);
    const effectiveByKey = new Map<string, EffectiveOperationsMap>();
    const storageFor = <T = Record<string, unknown>>(entity: string): Storage<T> | undefined =>
      ownedBy<Storage<T>>(fronds, container, entity, storageKeyOf(entity));
    const { hosting, journalOf } = rowHostsFor({
      fronds, container, options, remoteRouter, entityByName, frondOf, storageOf: storageFor,
    });

    const relations: RelationCheck[] = [];
    const plugged: Plugged[] = [];
    const boundPorts = new Set<string>();
    const doorMiddlewaresAt = new Map<string, DoorAround[]>();
    const keeping = await keepingOf(declaredState, storageFor, log);
    const assembly: Assembly = {
      container, routeRegistry, emissions, dispatcher, localDispatcher, effectiveByKey,
      boundPorts, refused, relations, rowHosts: hosting, operationModel, entityByName, frondOf, contractsOf,
      getMiddlewares, use, middlewaresOf: new Map(), doorMiddlewaresOf: new Map(), doorMiddlewaresAt, hostPortsOf: new Map(), log, options,
      state: appLifecycle.state(),
      extensions: appLifecycle.all(),
      plugged,
    };
    for (const frond of fronds) await installing(frond, assembly);

    warnAboutRelations(relations, hosting, log);
    refused.push(...unpaired(fronds.flatMap((frond) => frond.entities), hosting));
    refuseWhatDoesNotHold(refused);
    warnAboutUnboundPorts(options, boundPorts, log);

    const membership = new Membership({
      container, fronds, remoteRouter, dispatcher, localDispatcher, routeRegistry, effectiveByKey, log,
    });
    const facadeFor = (address: string, surface?: string) => membership.facadeFor(address, surface);
    const operationsFor = (address: string, surface?: string) => membership.operationsFor(address, surface);

    // A pipe order and an `Emit<T, A>` are read here, once every facade exists.
    emissions.register((facade) => facadeFor(addressOf(facade)));
    refuseWhatDoesNotHold(refused);
    markLineCarriers(emissions);

    const facadeServedRemotely = remoteRouter ? answerRemotes(assembly, remoteRouter, fronds) : () => false;

    const app: App = {
      container,
      fronds,
      protocols: options.protocols ?? {},
      // As DECLARED, beside what the runtime observes — the two disagree exactly when something is misconfigured.
      remotes: Object.freeze({ ...options.remotes }),
      dispatch: (call) => dispatcher.dispatch(call),
      local: localDispatcher,
      resolve: (name) => membership.resolve(name),
      schemaFor: (entity) => membership.schemaFor(entity),
      facadeFor,
      operationsFor,
      listensTo: () => emissions.listensTo(),
      listens: async (address, op) => {
        const read = operationsFor(address)?.get(op);
        if (read) return listens(read);
        // A frond known by its card alone: an address no remote answers is refused by the call itself.
        const route = await remoteRouter?.route(address).catch(() => undefined);

        return route?.listening.has(op) ?? false;
      },
      deliver: (fact, payload) => emissions.deliver(fact, payload),
      storageFor,
      presenterFor: (entity) => membership.presenterFor(entity),
      extensionPoints: () => [
        ...Registry.every().map(({ label, names }): Plugged => ({ point: label, by: 'name', answers: names })),
        ...plugged,
        { point: 'extension', by: 'name', answers: appLifecycle.names() },
      ],
      dispose: release,
      drain: (timeoutMs?: number) => inflight.drain(timeoutMs),
      inFlight: () => inflight.count,
      [Symbol.asyncDispose]: release,
      serveRpc: serveRpcOn(routeRegistry),
      extensions: () => appLifecycle.names(),
      observe: (observer) => dispatchLifecycle.add(observer),
      answer: (door, received) => answerAt(door, received, {
        enterRequest: (entered, fn) => request.within(entered, fn),
        lifecycle: dispatchLifecycle,
        middlewaresAt: (address) => doorMiddlewaresAt.get(address) ?? [],
        keeping,
      }),
      use(...args: [AppMiddleware] | [string, AppMiddleware]): void {
        return typeof args[0] === 'string'
          ? use(args[1] as AppMiddleware, args[0])
          : use(args[0] as AppMiddleware);
      },
    };

    container.registerValue('Releasing', releasing(hosting));
    serveCoreRpc(app, hosting, storageFor);

    createdApp = app;
    await appLifecycle.up(app);
    refuseWhatDoesNotHold(unregistered(container, fronds, facadeServedRemotely, resolveConventions(options.conventions)));
    refuseWhatDoesNotHold(dependencyCycles(container, fronds));
    stopAnnouncing = announceLines(emissions, container, lineBuffer);

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

function contractsOf(operations: EffectiveOperationsMap): OperationsMap {
  return new Map([...operations].map(([name, operation]) => [name, operation as OperationContract] as const));
}
