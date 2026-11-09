import { tablesOf } from '../descriptor/tables.js';
import { createContainer, type Container } from '@fougere/container';
import { resolveConventions } from '../Conventions.js';
import { unregistered } from './unregistered.js';
import { answerAt, type DoorAround } from '../entry/door.js';
import { keeperFronds, keepingOf } from '../module/state/keeping.js';
import { States } from '../module/state/States.js';
import { dependencyCycles } from './dependencyCycles.js';
import { type SchemaView } from '@fougere/schema';
import { valuing } from '../module/value/valuing.js';
import type { Fronds } from '../descriptor/Fronds.js';
import type { FrondDescriptor } from '../descriptor/FrondDescriptor.js';
import { installFrond, type Assembly } from './install.js';
import { releasing, unpaired } from '../module/relation/relations.js';
import { rowHostsFor } from '../module/relation/rowHostsFor.js';
import { warnAboutRelations } from '../module/relation/warnAboutRelations.js';
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
import { type RemoteRouter } from './remote.js';
import { Emissions } from '../module/fact/Emissions.js';
import type { OperationContract } from '../wire/OperationContract.js';
import type { OperationsMap } from '../wire/OperationsMap.js';
import { type EffectiveOperationsMap } from '../EffectiveOperationsMap.js';
import { addressOf } from '../wire/Facade.js';
import { AppLifecycle, checking, closeAll } from './AppLifecycle.js';
import { seeding } from './seed.js';
import { Registry } from '@fougere/registry';
import type { Plugged } from '../wire/Plugged.js';
import { storageKeyOf, type Storage } from '../storage/Storage.js';
import { Membership, ownedBy } from './Membership.js';
import { dispatching, serveCoreRpc, serveRpcOn } from './dispatching.js';
import { readFronds, refuseDuplicateKeys } from './readFronds.js';
import { answerRemotes, remoteRouterOf, transportAtOf } from './remote.js';

function whatTheAppKnows(
  fronds: Fronds,
  container: Container,
  options: CreateAppOptions,
  refused: Diagnostic[],
  remoteRouter: RemoteRouter | undefined,
): { entityByName: Map<string, SchemaView>; frondOf: Map<string, string>; emissions: Emissions } {
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
  if (!entityByName.has(LOG_LINE)) entityByName.set(LOG_LINE, LogLine);

  return {
    entityByName,
    frondOf: new Map(fronds.flatMap((one) => one.entities.map((entity) => [entity.name, one.name] as const))),
    emissions: new Emissions(
      fronds, entityByName, container,
      new Logger('boot:app'),
      refused,
      options.onEmit,
      remoteRouter,
    ),
  };
}

function registerBuiltins(container: Container, lineBuffer: LineBuffer): void {
  container.registerValue('Logger', new Logger('app', { lineBuffer, during: operation.current }));
}

function refuseWhatDoesNotHold(refused: Diagnostic[]): void {
  const refusal = refusalOf(refused, 'declaration(s) that do not hold');
  if (refusal) throw refusal;
}

async function installing(frond: FrondDescriptor, assembly: Assembly): Promise<void> {
  try {
    await installFrond(frond, assembly);
  } catch (failure) {
    if (!assembly.refused.some((one) => one.severity === 'blocking')) throw failure;
  }
}

function warnAboutUnboundPorts(options: CreateAppOptions, boundPorts: Set<string>, log: Logger): void {
  const unbound = Object.keys(options.ports ?? {}).filter((port) => !boundPorts.has(port));
  if (unbound.length === 0) return;

  log.warn(
    `[ports] ${unbound.join(', ')}: in fougere.config.ts, but no class extends ${unbound.length === 1 ? 'it' : 'them'}. `
    + 'Check the spelling, or remove the entry.',
  );
}

function markLineCarriers(emissions: Emissions): void {
  for (const facade of emissions.facadesFor(LOG_LINE)) {
    CARRIES_LINE.add(addressOf(facade));
    CARRIES_LINE.add(facade);
  }
}

function frondExtensions(fronds: Fronds): Extension[] {
  return fronds.flatMap((frond) => (frond.extensions ?? []).map((one) => ({ name: one.name, ...one.extension })));
}

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
  const appLifecycle = new AppLifecycle().add(checking(options.pending), valuing(options.values), seeding(), ...(options.extensions ?? []));
  const lineBuffer = new LineBuffer();
  let createdApp: App | undefined;
  let stopAnnouncing: (() => void) | undefined;

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
    const transportAt = await transportAtOf(options);
    const remoteRouter = remoteRouterOf(options, transportAt);
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
      fronds, container, options, transportAt, remoteRouter, entityByName, frondOf, storageOf: storageFor,
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

    emissions.register((facade) => facadeFor(addressOf(facade)));
    refuseWhatDoesNotHold(refused);
    markLineCarriers(emissions);

    const facadeServedRemotely = remoteRouter ? answerRemotes(assembly, remoteRouter, fronds) : () => false;

    const app: App = {
      container,
      fronds,
      protocols: options.protocols ?? {},
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
