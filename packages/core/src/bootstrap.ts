import { Judge } from '@fougere/schema';
import type { Container } from '@fougere/container';
import type { EntityEntry, HandlerEntry, PresenterEntry } from './frond.js';
import type { AuthRuntime } from './auth.js';
import type { CreateAppOptions, App } from './types.js';
import type { AppMiddleware } from './middleware.js';
import { runMiddlewares } from './middleware.js';
import { FougereError, ErrorCode } from './errors.js';
import { scanProject } from './scanner.js';
import { Logger, type LogLevel } from './builtins/logger.js';
import { Config } from './builtins/config.js';
import { createRemoteRouter, createRemoteFacade } from './remote.js';
import { Emissions } from './Emissions.js';
import { HandlerFacade } from './HandlerFacade.js';
import { targetOf } from './prefab.js';
import { facadeKeyOf, contractsKeyOf } from './call.js';
import { repositoryKeyOf } from './repository.js';
// The keys, each read from where its concept is declared — never respelled here.
import { ormKeyOf } from './orm.js';
import { presenterKeyOf } from './presenter.js';
import { collectorKeyOf } from './collector.js';

import { computeBindingPlan, resolveArgs, type CollectorResolver } from './binding.js';
import type { OperationContract, OperationsMap } from './operation.js';
import { resolveContracts } from './operation.js';
import { EMPTY_INVOCATION, type InvocationContext } from './invocation.js';
import { registrationKeyOf } from '@fougere/schema';
import type { SchemaView, Fields } from '@fougere/schema';
import { projectEgress, presentEgress, guardStorage, type PresenterArgs } from './egress.js';


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
  fronds: Array<{ name: string; handlers: HandlerEntry[]; presenters: PresenterEntry[] }>,
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
  const root = options.root ?? process.cwd();
  const container = options.createContainer();
  // Boot chatter is debug by default; a host (e.g. the CLI) can quiet it.
  const log = new Logger('boot:app', { level: (process.env.FOUGERE_LOG_LEVEL as LogLevel | undefined) ?? 'debug' });

  // Builtins — registered under class name (PascalCase) for type-based DI
  container.registerValue('Logger', new Logger());
  container.register('Config', Config, { lifetime: 'singleton' });
  log.debug('builtins registered (Logger, Config)');

  // Scan (with optional filter)
  const scanStart = performance.now();
  const { fronds, diagnostics } = await scanProject(root, options.fronds);
  const scanMs = (performance.now() - scanStart).toFixed(0);
  const blocking = diagnostics.filter((d) => d.severity === 'blocking');
  log.info(`scanned ${fronds.length} frond(s) in ${scanMs}ms`
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

  // Middleware storage — read at call time, not at boot time
  const globalMiddlewares: AppMiddleware[] = [];
  const scopedMiddlewares = new Map<string, AppMiddleware[]>();

  function getMiddlewares(entity: string): AppMiddleware[] {
    const scoped = scopedMiddlewares.get(entity) ?? [];
    return [...globalMiddlewares, ...scoped];
  }

  assertOneOwnerPerKey(fronds, options.remotes);

  // Every entity of every frond, by name — so a fact can be judged where it LANDS, and
  // so a `reads:` clause can name a neighbour's.
  const entityByName = fronds.schemas();
  const emissions = new Emissions(fronds, entityByName, container, log, options.onEmit);

  // Register frond scopes
  for (const frond of fronds) {
    // Declared remote: keep the scanned metadata (bridges route with it),
    // register nothing locally — resolve() falls through to the remote façade.
    if (options.remotes && frond.name in options.remotes) {
      log.child(frond.name).info('declared remote — not hosted locally');
      // Its doors answer elsewhere, but what they LISTEN to was read here.
      const remoteCollectors = new Set(frond.collectors.map((c) => c.entityName));
      for (const handler of frond.handlers) {
        emissions.note(
          resolveContracts(handler, frond.operationsOverrides, remoteCollectors),
          facadeKeyOf(handler.address, handler.surface),
        );
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
        .map((name) => entityByName.get(registrationKeyOf(name)))
        .filter((entity): entity is NonNullable<typeof entity> => entity !== undefined);
      if (named.length !== frond.reads.length) {
        const missing = frond.reads.filter((name) => !entityByName.has(registrationKeyOf(name)));
        frondLog.warn(
          `[reads] ${missing.join(', ')} — named in frond.config.ts but scanned nowhere in this app, `
          + 'so a query naming one would find no table. Check the spelling, or the entity file.',
        );
      }
      scope.registerValue('Sources', await options.sourcesFactory(named, frond.name));
      frondLog.debug(`cross-source reader over ${named.length} entit(ies)`);
    }

    for (const provider of frond.providers) {
      scope.register(provider.ctor.name, provider.ctor, { deps: provider.deps });
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

        // Storage is a way out like the client surface — see egress.ts.
        const guarded = guardStorage(scoped, entity.entityClass.getFields(), entity.name);
        scope.registerValue(ormName, guarded);

        // The default repository holds the port and adds nothing — the same shape a
        // declared one has, so a handler reads `repo.orm.list()` either way. Giving
        // the ORM itself as the default was shorter and wrong: `repo.orm` would then
        // exist only when someone had written the file, and the two forms would
        // differ exactly where the convention promises they do not.
        //
        // `providers` are registered above, so a declared repository is never
        // overwritten by this.
        const repoKey = repositoryKeyOf(entity.name);
        if (!scope.has(repoKey)) scope.registerValue(repoKey, { orm: guarded });
      }
      if (frond.entities.length > 0) {
        frondLog.debug(`${frond.entities.length} entity ORM(s): ${frond.entities.map((e) => e.name).join(', ')}`);
      }
    }

    // Register presenters in scope — PascalCase type name (e.g. 'PostPresenter')
    const presenterMap = new Map(frond.presenters.map((p) => [p.entityName, p]));
    for (const presenter of frond.presenters) {
      scope.register(presenterKeyOf(presenter.entityName), presenter.ctor, { deps: presenter.deps });
    }
    if (frond.presenters.length > 0) {
      frondLog.debug(`${frond.presenters.length} presenter(s): ${frond.presenters.map((p) => p.entityName).join(', ')}`);
    }

    // Register collectors in scope — PascalCase type name (e.g. 'UserCollector')
    const collectorEntityNames = new Set(frond.collectors.map((c) => c.entityName));
    for (const collector of frond.collectors) {
      const key = collectorKeyOf(collector.entityName);
      scope.register(key, collector.ctor, { deps: collector.deps });
    }
    if (frond.collectors.length > 0) {
      frondLog.debug(`${frond.collectors.length} collector(s): ${frond.collectors.map((c) => c.entityName).join(', ')}`);
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
        { handler, entity, scope: targetScope, key: facadeKey },
        {
          frondScope: scope,
          log: frondLog,
          overrides: frond.operationsOverrides,
          collectors: collectorEntityNames,
          presenters: presenterMap,
          middlewaresFor: getMiddlewares,
          emissions,
        },
      );
      container.registerValue(facadeKey, facade.ops);
      // The terms alongside the door, under the same audience — a surface that serves
      // fewer ops describes fewer ops.
      container.registerValue(contractsKeyOf(handler.address, handler.surface), facade.contracts);
      return facade.ops;
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
      const subject = crudTarget?.name ? registrationKeyOf(crudTarget.name) : handler.address;
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

      // Register scoped ORM if output override differs from entity
      if (entity && options.ormFactory) {
        const ormName = ormKeyOf(entity.name);
        const baseOrm = options.ormFactory(entity.entityClass, entity.name);
        const outputSchema = handler.outputOverride ?? (handler.ctor as any).__output;
        const scoped = outputSchema && outputSchema !== entity.entityClass
          ? baseOrm.output(outputSchema)
          : baseOrm;
        surfaceScope.registerValue(ormName, guardStorage(scoped, entity.entityClass.getFields(), entity.name));
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
    // Façade-shaped stand-in; routing happens lazily at the first call.
    return createRemoteFacade(name.replace(/Handler$/, ''), remoteRouter);
  });

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
   * Naming an audience closes it. Three ways to name an entity into a surface,
   * in precedence order:
   *   - `surfaces:` in frond.config.ts — when the list exists, it IS the list;
   *   - a handler under `handlers/<surface>/` — which also restricts the façade;
   *   - the `@expose` sugar, resolved into the same two by the scan.
   * What none of them names is not served. It used to be the reverse: no
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
    return declared.some((n) => n.toLowerCase() === entity.toLowerCase())
      ? (own ?? facadeAt(facadeKeyOf(entity), false))
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

  return {
    container,
    fronds,
    // What this app publishes, straight from fougere.config.ts — the doors read it,
    // so an undeclared adapter serves nothing whatever a host mounted.
    adapters: options.adapters ?? {},
    resolve,
    schemaFor,
    facadeFor,
    listensTo: () => emissions.listensTo(),
    deliver: (fact, payload) => emissions.deliver(fact, payload),
    ormFor,
    presenterFor,
    dispose: () => container.dispose(),
    [Symbol.asyncDispose]: () => container.dispose(),
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
}
