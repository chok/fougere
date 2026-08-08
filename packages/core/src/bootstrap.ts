import type { Container } from '@fougere/container';
import type { CreateAppOptions, App, AuthRuntime, HandlerEntry, PresenterEntry } from './types.js';
import type { AppMiddleware } from './middleware.js';
import { runMiddlewares, FougereError, ErrorCode } from './middleware.js';
import { scanProject } from './scanner.js';
import { Logger, type LogLevel } from './builtins/logger.js';
import { Config } from './builtins/config.js';
import { EventBus } from './builtins/event-bus.js';
import { createRemoteRouter, createRemoteFacade } from './remote.js';
import { facadeKeyOf } from './call.js';
import { repositoryKeyOf } from './repository.js';
// The keys, each read from where its concept is declared — never respelled here.
import { ormKeyOf } from './orm.js';
import { presenterKeyOf } from './presenter.js';
import { collectorKeyOf } from './collector.js';

import { computeBindingPlan, resolveArgs, type CollectorResolver } from './binding.js';
import type { OperationContract } from './operation.js';
import { resolveContracts } from './operation.js';
import { EMPTY_INVOCATION, type InvocationContext } from './invocation.js';
import { type SchemaLike, type Fields, validateFields } from '@fougere/schema';
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
  container.register('EventBus', EventBus, { lifetime: 'singleton' });
  log.debug('builtins registered (Logger, Config, EventBus)');

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

  // Register frond scopes
  for (const frond of fronds) {
    // Declared remote: keep the scanned metadata (bridges route with it),
    // register nothing locally — resolve() falls through to the remote façade.
    if (options.remotes && frond.name in options.remotes) {
      log.child(frond.name).info('declared remote — not hosted locally');
      continue;
    }
    const scope = container.createScope();
    const frondLog = log.child(frond.name);

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

    /**
     * Build a facade for a handler and register it in the root container.
     *
     * A facade is built FROM a handler — that is the whole rule, and the entity is
     * OPTIONAL. An entity is a shape, not a surface: on its own it declares no
     * operation, so it gets no facade and answers nothing. The converse used to be
     * false in fact though true on paper — the loop below walked entities, so a
     * handler naming no entity was scanned and then silently never built. An
     * operation that is about no stored row (`health.check`, a pure computation) is
     * an ordinary case, not a gap to accommodate.
     *
     * Without an entity a facade loses exactly three things, and nothing else: the
     * ORM injected by convention, the output fields to project onto, and the
     * presenter. Its result travels as the handler returned it.
     */
    const buildFacade = (
      entity: typeof frond.entities[number] | undefined,
      handler: typeof frond.handlers[number],
      targetScope: typeof scope,
      facadeKey: string,
    ) => {
      const handlerKey = `_handler:${facadeKey}`;
      // The ORM belongs to the SUBJECT, never to the address. `StockHandler extends
      // Crud(Item)` is called `stock` and reads `Item`; asking for `StockOrm` would be
      // asking the address for a table. The two coincide in the ordinary case and that
      // is why it went unnoticed.
      const ormBase = entity?.name ?? handler.address;
      const ormTypeName = ormKeyOf(ormBase);

      const inheritsCrud = typeof handler.ctor.prototype?.list === 'function'
        && typeof handler.ctor.prototype?.findById === 'function';
      const hasCrudInProto = handler.deps.length === 0 && inheritsCrud;
      const deps = handler.deps.length > 0
        ? handler.deps
        : hasCrudInProto ? [ormTypeName] : [];

      // Declaring a constructor turns the automatic ORM injection OFF — the handler now
      // states what it takes, and that is the whole DI convention. But a Crud handler
      // that forgets to state its ORM used to get `this.orm === undefined` and break on
      // the FIRST REQUEST, silently: `super()` assigns whatever it was handed. Refuse at
      // boot instead, naming the fix — the clause is deducible, so it is stated, not
      // configured.
      if (inheritsCrud && handler.deps.length > 0 && !handler.deps.includes(ormTypeName)) {
        throw new Error(
          `${handler.ctor.name} extends Crud() and declares a constructor, so the ORM is no ` +
          `longer injected for it — but it does not take one.\n` +
          `  Add it and hand it to super():\n` +
          `    constructor(orm: ${ormTypeName}, …) { super(orm); }`,
        );
      }

      // A Crud handler whose subject is not among the scanned entities is either broken
      // or installed — `Crud(Note)` from a published package is legitimate and the scan
      // cannot see it (CLAUDE.md, heritage resolution is workspace-only). Refusing at
      // boot would break the second case to catch the first, so it is said, not thrown.
      if (inheritsCrud && !entity) {
        frondLog.debug(`${handler.ctor.name} extends Crud() and no scanned entity is named `
          + `'${ormBase}' — installed entity, or a missing one: no ORM will be injected`);
      }

      targetScope.register(handlerKey, handler.ctor, { deps });

      let instance: any;
      const getInstance = () => {
        if (!instance) instance = targetScope.resolve(handlerKey);
        return instance;
      };

      /**
       * The contracts this façade serves — one function, shared with every other
       * reader, so nobody re-derives the three producers and drifts.
       */
      const contracts = resolveContracts(handler, frond.operationsOverrides, collectorEntityNames);

      /**
       * The field set an op's result is projected onto — the view declared for THAT op
       * (`Crud(Post, { list: PostCard })`), else the handler-wide view
       * (`Crud(Post, PostPublic)`), else the entity. Each op is the audience of its own
       * view: a public index emits cards while `bySlug` emits the full row, from one
       * handler reading one full-row ORM. Resolved once per op, on first call.
       */
      const cachedOutput = new Map<string, { fields: Fields; closed: boolean }>();
      const outputFieldsFor = (op: string) => {
        const known = cachedOutput.get(op);
        if (known) return known;
        const perOp = (handler?.ctor as { __opOutputs?: Record<string, unknown> })?.__opOutputs?.[op];
        const contractOutput = contracts.get(op)?.output;
        const schema = (perOp
          ?? contractOutput
          ?? handler?.outputOverride
          ?? (handler?.ctor as { __output?: unknown })?.__output
          // No entity and nothing declared: there is no shape to project onto, so the
          // result travels as the handler returned it (`encodeFields({}, r)` is `{…r}`).
          ?? entity?.entityClass) as { getFields?: () => Fields };
        const fields = typeof schema?.getFields === 'function' ? schema.getFields() : {};
        // A view named for THIS op is a closed list: the author said what this
        // audience gets. The handler-wide forms already narrow at the ORM.
        const resolved = { fields, closed: perOp !== undefined };
        cachedOutput.set(op, resolved);
        return resolved;
      };

      const collectorResolver = (entityName: string): CollectorResolver | undefined => {
        const key = collectorKeyOf(entityName);
        try { return targetScope.resolve(key) as CollectorResolver; }
        catch { return undefined; }
      };

      // The name the door answers to. It reaches the presenter map below, which is keyed
      // by ENTITY name — they coincide whenever both exist, and when no entity carries
      // this name the lookup simply misses, which is the correct answer.
      const address = handler.address;
      const wrapOp = (op: string) => (invocation?: InvocationContext) => {
        const inv = invocation ?? EMPTY_INVOCATION;
        const ctx = { entity: address, operation: op, args: [], state: inv.state, invocation: inv };

        return runMiddlewares(getMiddlewares(address), ctx, async () => {
          const contract = contracts.get(op);
          const schema = contract?.input;
          let effectiveInvocation = inv;
          if (schema && inv.body && typeof inv.body === 'object') {
            // The view's mode travels with it: a partial() input validates as a
            // patch (absent field → untouched), never by forging the fields.
            // No field filter: the axes already judge every case — a client id
            // at create is accepted ({ generate }), an id re-supplied in a
            // patch is 'Immutable', a read-only field 'Read-only', every
            // system-stamped absence is legal via its lifecycle rule, and a
            // key outside the contract is 'Unknown field' (refused, not stripped).
            const result = validateFields(schema.getFields(), inv.body, '', { patch: schema.getOpts?.().patch });
            if (!result.success) {
              throw new FougereError({
                code: ErrorCode.VALIDATION_FAILED,
                message: result.errors.map((e) => `${e.path}: ${e.message}`).join(', '),
                details: result.errors,
                entity: address,
                operation: op,
              });
            }
            effectiveInvocation = { ...inv, body: result.data };
            ctx.invocation = effectiveInvocation;
          }

          // No plan means no declared argument — an op receives what its
          // contract says it receives, never a guess based on its name.
          const resolved = contract?.binding
            ? await resolveArgs(contract.binding, effectiveInvocation, collectorResolver)
            : [];
          // Egress at the boundary: a write-only field never rides the result
          // out, exactly as REST and Pothos already guarantee on their own —
          // then a presenter's computed fields are added, so every door answers
          // the same thing (they used to be applied by the projections alone).
          const out = outputFieldsFor(op);
          const projected = projectEgress(out.fields, await getInstance()[op](...resolved), out.closed);
          if (out.closed) return projected;
          const meta = presenterMap.get(address);
          if (!meta) return projected;

          // A computed field is bound like an op: what it declares after the rows is
          // resolved from the same invocation, by the same collectors. The plan is
          // computed here and not at scan time because the scan meets presenters
          // before it meets collectors.
          const args: PresenterArgs = {};
          for (const field of meta.fieldMeta) {
            if (!field.params?.length) continue;
            args[field.name] = await resolveArgs(
              computeBindingPlan(field.params, collectorEntityNames),
              effectiveInvocation,
              collectorResolver,
            );
          }

          return presentEgress(
            projected,
            scope.resolve(presenterKeyOf(address)),
            meta.fields,
            address,
            op,
            args,
          );
        });
      };

      // The surface IS the contract table. A method nobody declared is not an
      // op: it stays a method, callable from inside, unreachable from the wire.
      const facade: Record<string, Function> = {};
      for (const op of contracts.keys()) {
        facade[op] = wrapOp(op);
      }

      container.registerValue(facadeKey, facade);
      // The terms alongside the door, under the same audience — a surface that
      // serves fewer ops describes fewer ops.
      container.registerValue(`${facadeKey}:contracts`, contracts);
      return facade;
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
      const crudTarget = (handler.ctor as { __entity?: { name?: string } }).__entity;
      const subject = crudTarget?.name
        ? crudTarget.name[0].toLowerCase() + crudTarget.name.slice(1)
        : handler.address;
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

  const schemaFor = async (entity: string): Promise<SchemaLike> => {
    for (const frond of fronds) {
      const found = frond.entities.find((e) => e.name === entity);
      if (found) return found.entityClass;
    }
    if (remoteRouter) {
      const route = await remoteRouter.route(entity);
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
    const declared = fronds.find((f) => f.entities.some((e) => e.name === entity))?.surfaces?.[surface];
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
    const owner = fronds.find((f) => f.entities.some((e) => e.name === entity));
    if (!owner) return undefined;

    const key = ormKeyOf(entity);
    try {
      return container.resolve<Container>(`frond:${owner.name}`).resolve(key);
    } catch {
      return undefined;
    }
  };

  return {
    container,
    fronds,
    resolve,
    schemaFor,
    facadeFor,
    ormFor,
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
