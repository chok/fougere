import type { CreateAppOptions, App, AuthRuntime } from './types.js';
import type { AppMiddleware } from './middleware.js';
import { runMiddlewares, FougereError, ErrorCode } from './middleware.js';
import { scanProject } from './scanner.js';
import { Logger, type LogLevel } from './builtins/logger.js';
import { Config } from './builtins/config.js';
import { EventBus } from './builtins/event-bus.js';
import { CrudFor } from './crud.js';
import { createRemoteRouter, createRemoteFacade } from './remote.js';
import { computeBindingPlan, resolveArgs, type BindingPlan, type CollectorResolver } from './binding.js';
import { EMPTY_INVOCATION, type InvocationContext } from './invocation.js';
import { type SchemaLike, validateFields } from '@fougere/schema';

const CRUD_OPS = new Set(['list', 'findById', 'create', 'update', 'delete']);
const READ_ONLY_OPS = ['list', 'findById'];


/** Default argument binding for inherited CRUD methods (no AST scan available). */
function defaultCrudArgs(op: string, ctx: InvocationContext): unknown[] {
  switch (op) {
    case 'list': return [ctx.query];
    case 'findById': return [ctx.params.id ?? ctx.query.id];
    case 'create': return [ctx.body];
    case 'update': return [ctx.params.id ?? ctx.query.id, ctx.body];
    case 'delete': return [ctx.params.id ?? ctx.query.id];
    default: return [];
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
        const orm = outputSchema && outputSchema !== entity.entityClass
          ? baseOrm.output(outputSchema)
          : baseOrm;

        scope.registerValue(ormName, orm);
      }
      if (frond.entities.length > 0) {
        frondLog.debug(`${frond.entities.length} entity ORM(s): ${frond.entities.map((e) => e.name).join(', ')}`);
      }
    }

    // Register presenters in scope — PascalCase type name (e.g. 'PostPresenter')
    const presenterMap = new Map(frond.presenters.map((p) => [p.entityName, p]));
    for (const presenter of frond.presenters) {
      const key = `${presenter.entityName[0].toUpperCase()}${presenter.entityName.slice(1)}Presenter`;
      scope.register(key, presenter.ctor, { deps: presenter.deps });
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

    /** Build a facade for a handler and register it in the root container. */
    const buildFacade = (
      entity: typeof frond.entities[number],
      handler: typeof frond.handlers[number] | undefined,
      targetScope: typeof scope,
      facadeKey: string,
    ) => {
      const handlerKey = `_handler:${facadeKey}`;
      const ormTypeName = `${entity.name[0].toUpperCase()}${entity.name.slice(1)}Orm`;

      if (!handler) {
        const HandlerClass = CrudFor(entity.name, entity.entityClass as any);
        targetScope.register(handlerKey, HandlerClass, { deps: [ormTypeName] });
      } else {
        const hasCrudInProto = handler.deps.length === 0
          && typeof handler.ctor.prototype?.list === 'function'
          && typeof handler.ctor.prototype?.findById === 'function';
        const deps = handler.deps.length > 0
          ? handler.deps
          : hasCrudInProto ? [ormTypeName] : [];
        targetScope.register(handlerKey, handler.ctor, { deps });
      }

      const ops = handler
        ? [...handler.operations.keys()]
        : [...READ_ONLY_OPS];

      let instance: any;
      const getInstance = () => {
        if (!instance) instance = targetScope.resolve(handlerKey);
        return instance;
      };

      const bindingPlans = new Map<string, BindingPlan>();
      const inputSchemas = new Map<string, SchemaLike>();
      if (handler) {
        for (const [opName, meta] of handler.operations) {
          if (meta.signature) {
            bindingPlans.set(opName, computeBindingPlan(meta.signature.params, collectorEntityNames));
          }
          if (meta.input) inputSchemas.set(opName, meta.input);
        }
      }

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
          const schema = inputSchemas.get(op);
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

          const plan = bindingPlans.get(op);
          const resolved = plan
            ? await resolveArgs(plan, inv, collectorResolver)
            : defaultCrudArgs(op, inv);
          return getInstance()[op](...resolved);
        });
      };

      const facade: Record<string, Function> = {};
      for (const op of ops) {
        facade[op] = wrapOp(op);
      }

      if (handler) {
        let proto = handler.ctor.prototype;
        while (proto && proto !== Object.prototype) {
          for (const name of Object.getOwnPropertyNames(proto)) {
            if (name === 'constructor' || name.startsWith('_') || facade[name]) continue;
            if (typeof proto[name] === 'function') {
              facade[name] = wrapOp(name);
            }
          }
          proto = Object.getPrototypeOf(proto);
        }
      }

      container.registerValue(facadeKey, facade);
      return facade;
    };

    // Default handlers (no surface) — one per entity
    for (const entity of frond.entities) {
      const handler = defaultHandlerMap.get(entity.name);
      const facadeKey = `${entity.name}Handler`;
      buildFacade(entity, handler, scope, facadeKey);

      // Expose presenter instance (lazy — resolved on first access by bridge)
      const presenter = presenterMap.get(entity.name);
      if (presenter) {
        const presenterKey = `${entity.name[0].toUpperCase()}${entity.name.slice(1)}Presenter`;
        let presenterInstance: any;
        container.registerValue(presenterKey, new Proxy({} as any, {
          get(_target, prop) {
            if (!presenterInstance) presenterInstance = scope.resolve(presenterKey);
            return presenterInstance[prop];
          },
        }));
      }

      frondLog.debug(`${facadeKey} [${Object.keys(container.resolve(facadeKey) as any).join(', ')}]`);
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
        const orm = outputSchema && outputSchema !== entity.entityClass
          ? baseOrm.output(outputSchema)
          : baseOrm;
        surfaceScope.registerValue(ormName, orm);
      }

      const facadeKey = `${handler.surface}:${entity.name}Handler`;
      buildFacade(entity, handler, surfaceScope, facadeKey);
      frondLog.debug(`${facadeKey} [${Object.keys(container.resolve(facadeKey) as any).join(', ')}]`);
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

  return {
    container,
    fronds,
    resolve,
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
