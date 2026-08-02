import type { CreateAppOptions, App, AuthRuntime } from './types.js';
import type { AppMiddleware } from './middleware.js';
import { runMiddlewares, FougereError, ErrorCode } from './middleware.js';
import { scanProject } from './scanner.js';
import { Logger, type LogLevel } from './builtins/logger.js';
import { Config } from './builtins/config.js';
import { EventBus } from './builtins/event-bus.js';
import { createRemoteRouter, createRemoteFacade } from './remote.js';
import { facadeKeyOf } from './call.js';

import { computeBindingPlan, resolveArgs, type CollectorResolver } from './binding.js';
import type { OperationContract } from './operation.js';
import { EMPTY_INVOCATION, type InvocationContext } from './invocation.js';
import { type SchemaLike, type Fields, validateFields } from '@fougere/schema';
import { projectEgress, presentEgress, guardStorage } from './egress.js';

/** Container key of an entity's presenter — 'post' → 'PostPresenter'. */
const presenterKeyOf = (entity: string) => `${entity[0].toUpperCase()}${entity.slice(1)}Presenter`;

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
  const { fronds } = await scanProject(root, options.fronds);
  const scanMs = (performance.now() - scanStart).toFixed(0);
  log.info(`scanned ${fronds.length} frond(s) in ${scanMs}ms`);

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
        const ormName = `${entity.name[0].toUpperCase()}${entity.name.slice(1)}Orm`;
        const baseOrm = options.ormFactory(entity.entityClass, entity.name);

        // Check if the default handler (no surface) declares an output override
        const defaultHandler = frond.handlers.find((h) => h.entityName === entity.name && !h.surface);
        const outputSchema = defaultHandler?.outputOverride ?? (defaultHandler?.ctor as any)?.__output;
        const scoped = outputSchema && outputSchema !== entity.entityClass
          ? baseOrm.output(outputSchema)
          : baseOrm;

        // Storage is a way out like the client surface — see egress.ts.
        scope.registerValue(ormName, guardStorage(scoped, entity.entityClass.getFields(), entity.name));
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
      const key = `${collector.entityName[0].toUpperCase()}${collector.entityName.slice(1)}Collector`;
      scope.register(key, collector.ctor, { deps: collector.deps });
    }
    if (frond.collectors.length > 0) {
      frondLog.debug(`${frond.collectors.length} collector(s): ${frond.collectors.map((c) => c.entityName).join(', ')}`);
    }

    // Build handler facades → registered in ROOT container (public contract)
    const defaultHandlers = frond.handlers.filter((h) => !h.surface);
    const surfaceHandlers = frond.handlers.filter((h) => h.surface);
    const defaultHandlerMap = new Map(defaultHandlers.map((h) => [h.entityName, h]));

    /**
     * Build a facade for a handler and register it in the root container.
     *
     * A facade is built FROM a handler — that is the whole rule. An entity is
     * a shape, not a surface: on its own it declares no operation, so it gets
     * no facade and answers nothing. Exposing it would mean the framework
     * deciding, on the author's behalf, that its rows are public.
     */
    const buildFacade = (
      entity: typeof frond.entities[number],
      handler: typeof frond.handlers[number],
      targetScope: typeof scope,
      facadeKey: string,
    ) => {
      const handlerKey = `_handler:${facadeKey}`;
      const ormTypeName = `${entity.name[0].toUpperCase()}${entity.name.slice(1)}Orm`;

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

      targetScope.register(handlerKey, handler.ctor, { deps });

      let instance: any;
      const getInstance = () => {
        if (!instance) instance = targetScope.resolve(handlerKey);
        return instance;
      };

      /**
       * The contracts this façade serves, by op name — the whole surface.
       *
       * Two producers, and the closest author of an op wins. A prefab handler
       * DECLARES what it built (`Crud(E)` knows its five, at runtime, so no
       * scan is needed to protect them). The scan DERIVES from source: a
       * method written in this very file is the author's own word and beats
       * everything; a method it merely READ on a base class is a guess about
       * someone else's code, and yields to that code's own declaration.
       *
       * The binding is resolved here, so nothing downstream ever sees an AST.
       */
      const declared = (handler.ctor as { __ops?: Record<string, OperationContract> }).__ops ?? {};
      const contracts = new Map<string, OperationContract>(Object.entries(declared));
      for (const [opName, scanned] of handler.operations) {
        if (scanned.signature?.inherited && opName in declared) continue;
        contracts.set(opName, {
          ...scanned,
          binding: scanned.binding
            ?? (scanned.signature ? computeBindingPlan(scanned.signature.params, collectorEntityNames) : undefined),
        });
      }

      /**
       * The third producer: config STATES a contract the other two could only guess at.
       * It wins — it is the most explicit statement, made by whoever assembles the app
       * (CLI > frond config > fougere config > scan > conventions).
       *
       * It also CREATES the entry when neither producer found one, which is the only
       * answer today for a method inherited from an *installed* base class: heritage
       * resolution is workspace-only, so the scan finds nothing and says nothing, and
       * the op silently misses the façade. Declaring it here puts it back.
       *
       * Per key, so stating a `binding` alone does not erase an `input` the scan found.
       */
      for (const [opName, override] of Object.entries(frond.operationsOverrides ?? {})) {
        const { input, binding } = override;
        if (input === undefined && binding === undefined) continue;
        contracts.set(opName, {
          ...contracts.get(opName),
          ...(input !== undefined && { input }),
          ...(binding !== undefined && { binding }),
        });
      }

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
        const schema = (perOp
          ?? handler?.outputOverride
          ?? (handler?.ctor as { __output?: unknown })?.__output
          ?? entity.entityClass) as { getFields?: () => Fields };
        const fields = typeof schema?.getFields === 'function' ? schema.getFields() : {};
        // A view named for THIS op is a closed list: the author said what this
        // audience gets. The handler-wide forms already narrow at the ORM.
        const resolved = { fields, closed: perOp !== undefined };
        cachedOutput.set(op, resolved);
        return resolved;
      };

      const collectorResolver = (entityName: string): CollectorResolver | undefined => {
        const key = `${entityName[0].toUpperCase()}${entityName.slice(1)}Collector`;
        try { return targetScope.resolve(key) as CollectorResolver; }
        catch { return undefined; }
      };

      const entityName = entity.name;
      const wrapOp = (op: string) => (invocation?: InvocationContext) => {
        const inv = invocation ?? EMPTY_INVOCATION;
        const ctx = { entity: entityName, operation: op, args: [], state: inv.state, invocation: inv };

        return runMiddlewares(getMiddlewares(entityName), ctx, async () => {
          const contract = contracts.get(op);
          const schema = contract?.input;
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
                entity: entityName,
                operation: op,
              });
            }
          }

          // No plan means no declared argument — an op receives what its
          // contract says it receives, never a guess based on its name.
          const resolved = contract?.binding
            ? await resolveArgs(contract.binding, inv, collectorResolver)
            : [];
          // Egress at the boundary: a write-only field never rides the result
          // out, exactly as REST and Pothos already guarantee on their own —
          // then a presenter's computed fields are added, so every door answers
          // the same thing (they used to be applied by the projections alone).
          const out = outputFieldsFor(op);
          const projected = projectEgress(out.fields, await getInstance()[op](...resolved), out.closed);
          if (out.closed) return projected;
          const meta = presenterMap.get(entity.name);
          return meta
            ? presentEgress(projected, scope.resolve(presenterKeyOf(entity.name)), meta.fields, entityName, op)
            : projected;
        });
      };

      // The surface IS the contract table. A method nobody declared is not an
      // op: it stays a method, callable from inside, unreachable from the wire.
      const facade: Record<string, Function> = {};
      for (const op of contracts.keys()) {
        facade[op] = wrapOp(op);
      }

      container.registerValue(facadeKey, facade);
      return facade;
    };

    // Default handlers (no surface) — one per entity that declares one
    for (const entity of frond.entities) {
      const handler = defaultHandlerMap.get(entity.name);
      const facadeKey = facadeKeyOf(entity.name);
      if (handler) buildFacade(entity, handler, scope, facadeKey);

      // Expose presenter instance (lazy — resolved on first access by bridge)
      const presenter = presenterMap.get(entity.name);
      if (presenter) {
        const presenterKey = presenterKeyOf(entity.name);
        let presenterInstance: any;
        container.registerValue(presenterKey, new Proxy({} as any, {
          get(_target, prop) {
            if (!presenterInstance) presenterInstance = scope.resolve(presenterKey);
            return presenterInstance[prop];
          },
        }));
      }

      frondLog.debug(handler
        ? `${facadeKey} [${Object.keys(container.resolve(facadeKey) as any).join(', ')}]`
        : `${entity.name} — entity only, no handler: exposes nothing`);
    }

    // Surface handlers — create sub-scope per surface handler with scoped ORM
    for (const handler of surfaceHandlers) {
      const entity = frond.entities.find((e) => e.name === handler.entityName);
      if (!entity) continue;

      const surfaceScope = scope.createScope();

      // Register scoped ORM if output override differs from entity
      if (options.ormFactory) {
        const ormName = `${entity.name[0].toUpperCase()}${entity.name.slice(1)}Orm`;
        const baseOrm = options.ormFactory(entity.entityClass, entity.name);
        const outputSchema = handler.outputOverride ?? (handler.ctor as any).__output;
        const scoped = outputSchema && outputSchema !== entity.entityClass
          ? baseOrm.output(outputSchema)
          : baseOrm;
        surfaceScope.registerValue(ormName, guardStorage(scoped, entity.entityClass.getFields(), entity.name));
      }

      const facadeKey = facadeKeyOf(entity.name, handler.surface);
      buildFacade(entity, handler, surfaceScope, facadeKey);
      frondLog.debug(`${facadeKey} [${Object.keys(container.resolve(facadeKey) as any).join(', ')}]`);
    }

    // A named surface is closed, so what it contains is a fact worth stating.
    // Saying it at boot is the difference between a rule and a rule you can
    // check: an entity you meant to serve and never wrote a handler for is
    // absent HERE, in one line, instead of being discovered missing later.
    const surfaceNames = [...new Set(surfaceHandlers.map((h) => h.surface as string))].sort();
    for (const surfaceName of surfaceNames) {
      const served = surfaceHandlers
        .filter((h) => h.surface === surfaceName)
        .map((h) => h.entityName)
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

  const resolve = <T>(name: string): T => {
    try {
      return container.resolve<T>(name);
    } catch (err) {
      // Surface-scoped keys ('admin:productHandler') stay local — no remote fallback.
      if (name.endsWith('Handler') && !name.includes(':')) {
        const entityName = name.replace(/Handler$/, '');
        if (remoteRouter) {
          // Façade-shaped stand-in; routing happens lazily at the first call.
          const facade = createRemoteFacade(entityName, remoteRouter);
          container.registerValue(name, facade);
          return facade as T;
        }
        throw new Error(
          `Frond for '${entityName}' is not loaded.\n` +
          `  - Add '${entityName}' to --fronds flag\n` +
          `  - Or declare a remote: remotes: { ${entityName}: 'http://...' }`,
        );
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
    throw new Error(`Frond for '${entity}' is not loaded.`);
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

  return {
    container,
    fronds,
    resolve,
    schemaFor,
    facadeFor,
    dispose: () => container.dispose(),
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
