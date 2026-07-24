import { readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname, resolve as resolvePath } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { FrondDescriptor, ProviderEntry, EntityEntry, HandlerEntry, PresenterEntry, CollectorEntry, SeedEntry, ScanResult } from './types.js';
import type { SchemaLike } from '@fougere/schema';
import type { OperationContract, OperationsMap } from './operation.js';
import { parseAllHandlerMethods, parsePresenterMethods, parseConstructorParams, type ParsedType } from './handler-parser.js';
import { hashFile, getCached, setCached, flushCache, setCacheRoot } from './scan-cache.js';
import { loadFrondConfig } from './frond-config.js';
import { getPresenterTarget, getPresenterFields } from './presenter.js';
import { getCollectorTarget } from './collector.js';

/** Module loader — can be swapped (e.g. jiti for TS files in Nuxt context). */
export type ModuleLoader = (filePath: string) => Promise<Record<string, unknown>>;

const defaultLoader: ModuleLoader = async (filePath) =>
  await import(pathToFileURL(filePath).href);

let activeLoader: ModuleLoader = defaultLoader;

/** Override the module loader used by the scanner (e.g. for jiti/tsx support). */
export function setModuleLoader(loader: ModuleLoader): void {
  activeLoader = loader;
}

/** Used by config-loader to load fougere.config.ts via the same TS-aware loader. */
export function getModuleLoader(): ModuleLoader {
  return activeLoader;
}

// FS

async function dirs(path: string): Promise<string[]> {
  const entries = await readdir(path, { withFileTypes: true }).catch(() => []);
  return entries.filter((e) => e.isDirectory()).map((e) => e.name);
}

async function files(path: string): Promise<string[]> {
  const entries = await readdir(path, { withFileTypes: true }).catch(() => []);
  return entries
    .filter((e) => e.isFile() && (e.name.endsWith('.ts') || e.name.endsWith('.js')))
    .map((e) => join(path, e.name));
}

// Module

async function loadModule(filePath: string): Promise<Record<string, unknown>> {
  return await activeLoader(filePath);
}

async function loadDefault(filePath: string): Promise<unknown> {
  const mod = await loadModule(filePath);
  return mod.default;
}

async function loadClass(filePath: string): Promise<ProviderEntry['ctor']> {
  const ctor = await loadDefault(filePath);
  if (typeof ctor !== 'function' || !ctor.prototype)
    throw new Error(`${filePath}: default export is not a class`);
  return ctor as ProviderEntry['ctor'];
}

function isEntityClass(value: unknown): value is SchemaLike {
  return typeof value === 'function' && 'getFields' in (value as any);
}

// Workspace

/** Walk up from project root to find the monorepo root (pnpm-workspace.yaml + packages/). */
function findWorkspaceRoot(from: string): string {
  let dir = resolvePath(from);
  while (dir !== dirname(dir)) {
    if (existsSync(join(dir, 'pnpm-workspace.yaml')) && existsSync(join(dir, 'packages'))) return dir;
    dir = dirname(dir);
  }
  return resolvePath(from); // fallback: use project root itself
}

// Convention

const KINDS: Record<string, ProviderEntry['kind']> = {
  services: 'service',
  repositories: 'repository',
};

export { toRegistrationName } from './contract.js';
import { toRegistrationName } from './contract.js';

/** Strip 'Handler' suffix → entity name. 'PostHandler' → 'post'. */
function toEntityName(className: string): string {
  const base = className.endsWith('Handler') ? className.slice(0, -7) : className;
  return base[0].toLowerCase() + base.slice(1);
}

// Scan

/** Cached parseConstructorParams — skips TS loading when cache is warm. */
async function cachedCtorParams(filePath: string) {
  const hash = hashFile(filePath);
  const key = filePath + ':ctor';
  const cached = getCached<Awaited<ReturnType<typeof parseConstructorParams>>>(key, hash);
  if (cached) return cached;
  const params = await parseConstructorParams(filePath);
  setCached(key, hash, params);
  return params;
}

/** Cached parsePresenterMethods — skips TS loading when cache is warm. */
async function cachedPresenterMethods(filePath: string) {
  const hash = hashFile(filePath);
  const key = filePath + ':presenter';
  const cached = getCached<Awaited<ReturnType<typeof parsePresenterMethods>>>(key, hash);
  if (cached) return cached;
  const methods = await parsePresenterMethods(filePath);
  setCached(key, hash, methods);
  return methods;
}

async function toProvider(filePath: string, kind: ProviderEntry['kind']): Promise<ProviderEntry> {
  const ctor = await loadClass(filePath);
  const params = await cachedCtorParams(filePath);
  const deps = params.map((p) => p.type.name);
  return { name: toRegistrationName(ctor.name), ctor, kind, deps, filePath };
}

async function toEntityEntry(filePath: string): Promise<EntityEntry | null> {
  const exported = await loadDefault(filePath);
  if (!isEntityClass(exported)) return null;
  const name = toRegistrationName((exported as any).name);
  return { name, entityClass: exported, filePath };
}

/**
 * Resolve a ParsedType to a runtime schema if available in module exports.
 * Handles arrays, generics (uses base name), and simple references.
 */
function resolveSchema(type: ParsedType, moduleExports: Record<string, unknown>): SchemaLike | undefined {
  // For arrays, resolve the element type
  const name = type.array ? type.name : type.name;
  // For generics like Pagination<Post>, also check inner types
  if (type.generics) {
    for (const g of type.generics) {
      const resolved = moduleExports[g.name];
      if (resolved && typeof resolved === 'function' && 'getFields' in resolved) {
        // `Partial<X>` in a signature IS the patch declaration (Crud.update) —
        // project it onto the schema view instead of dropping the wrapper, so
        // the facade validates in patch mode (absent field → untouched).
        if (type.name === 'Partial' && 'partial' in resolved && typeof (resolved as any).partial === 'function') {
          return (resolved as any).partial() as SchemaLike;
        }
        return resolved as SchemaLike;
      }
    }
  }
  const resolved = moduleExports[name];
  if (resolved && typeof resolved === 'function' && 'getFields' in resolved) {
    return resolved as SchemaLike;
  }
  return undefined;
}

/**
 * Parse ALL method signatures for unified binding.
 *
 * Resolves schemas for all params (not just the first) and stores
 * full signatures for the binding algorithm.
 */
async function inferOperations(filePath: string, moduleExports: Record<string, unknown>, projectRoot?: string): Promise<OperationsMap> {
  const map = new Map<string, OperationContract>();
  let parsed: Awaited<ReturnType<typeof parseAllHandlerMethods>>;
  try {
    const hash = hashFile(filePath);
    const cacheKey = filePath + ':all' + (projectRoot ? ':inherited' : '');
    const cached = getCached<Awaited<ReturnType<typeof parseAllHandlerMethods>>>(cacheKey, hash);
    if (cached) {
      parsed = cached;
    } else {
      parsed = await parseAllHandlerMethods(filePath, projectRoot);
      setCached(cacheKey, hash, parsed);
    }
  } catch {
    return map;
  }

  for (const method of parsed) {
    const meta: OperationContract = { signature: method };

    // Resolve schemas for all params
    for (const param of method.params) {
      const schema = resolveSchema(param.type, moduleExports);
      if (schema && !meta.input) meta.input = schema;
    }

    if (method.returnType) {
      meta.output = resolveSchema(method.returnType, moduleExports);
    }

    map.set(method.name, meta);
  }

  return map;
}

async function toHandlerEntry(
  filePath: string,
  entityByClassName: Map<string, SchemaLike>,
  projectRoot?: string,
  surface?: string,
): Promise<HandlerEntry> {
  const mod = await loadModule(filePath);
  const ctor = mod.default;
  if (typeof ctor !== 'function' || !ctor.prototype)
    throw new Error(`${filePath}: default export is not a class`);

  // Augment module exports with known entity classes so resolveSchema
  // can find them when T is substituted (e.g. T → Post after parsing Crud(Post))
  const augmented: Record<string, unknown> = { ...mod };
  for (const [className, entityClass] of entityByClassName) {
    if (!(className in augmented)) augmented[className] = entityClass;
  }

  const entityName = toEntityName(ctor.name);
  const operations = await inferOperations(filePath, augmented, projectRoot);
  const ctorParams = await cachedCtorParams(filePath);
  const deps = ctorParams.map((p) => p.type.name);

  // Read output override from Crud(Entity, Output) — static __output property
  const __entity = (ctor as any).__entity;
  const __output = (ctor as any).__output;
  const outputOverride = __output && __entity && __output !== __entity ? __output : undefined;

  return {
    name: toRegistrationName(ctor.name),
    entityName,
    ctor: ctor as ProviderEntry['ctor'],
    operations,
    deps,
    filePath,
    outputOverride,
    surface,
  };
}

/** Strip '.seed' suffix → entity name. 'Author.seed.ts' → 'author'. */
function toSeedEntityName(fileName: string): string {
  const base = fileName.replace(/\.seed\.(ts|js)$/, '').replace(/\.(ts|js)$/, '');
  return base[0].toLowerCase() + base.slice(1);
}

async function toSeedEntry(filePath: string): Promise<SeedEntry | null> {
  const data = await loadDefault(filePath);
  if (Array.isArray(data) || typeof data === 'function') {
    const fileName = filePath.split('/').pop()!;
    return { entityName: toSeedEntityName(fileName), data: data as SeedEntry['data'], filePath };
  }
  return null;
}

async function toPresenterEntry(filePath: string): Promise<PresenterEntry | null> {
  const ctor = await loadClass(filePath);
  const target = getPresenterTarget(ctor);
  if (!target) return null;
  const entityName = toRegistrationName((target as any).name);
  const fields = getPresenterFields(ctor);
  const presenterParams = await cachedCtorParams(filePath);
  const deps = presenterParams.map((p) => p.type.name);

  // Parse method return types from source
  let fieldMeta: PresenterEntry['fieldMeta'] = [];
  try {
    const parsed = await cachedPresenterMethods(filePath);
    fieldMeta = parsed.map((m) => ({
      name: m.name,
      returnType: m.returnType?.name,
      nullable: m.returnType?.nullable,
    }));
  } catch { /* parse failure — fall back to untyped */ }

  return { entityName, ctor, fields, fieldMeta, deps, filePath };
}

async function toCollectorEntry(filePath: string): Promise<CollectorEntry | null> {
  const ctor = await loadClass(filePath);
  const target = getCollectorTarget(ctor);
  if (!target) return null;
  const entityName = toRegistrationName((target as any).name);
  const collectorParams = await cachedCtorParams(filePath);
  const deps = collectorParams.map((p) => p.type.name);
  return { entityName, ctor, deps, filePath };
}

async function scanFrond(frondPath: string, name: string, source: FrondDescriptor['source'], projectRoot?: string): Promise<FrondDescriptor> {
  const providers: ProviderEntry[] = [];
  const entities: EntityEntry[] = [];
  const handlers: HandlerEntry[] = [];
  const presenters: PresenterEntry[] = [];
  const collectors: CollectorEntry[] = [];
  const seeds: SeedEntry[] = [];

  // Scan services/ and repositories/
  for (const [dir, kind] of Object.entries(KINDS)) {
    const paths = await files(join(frondPath, dir));
    providers.push(...await Promise.all(paths.map((f) => toProvider(f, kind))));
  }

  // Scan entities/
  const entityPaths = await files(join(frondPath, 'entities'));
  const entityEntries = await Promise.all(entityPaths.map((f) => toEntityEntry(f)));
  entities.push(...entityEntries.filter((e): e is EntityEntry => e !== null));

  // Build entity class map for schema resolution in handlers (T → entity class)
  const entityByClassName = new Map(
    entities.map((e) => [(e.entityClass as any).name as string, e.entityClass]),
  );

  // Scan handlers/ (root = default surface, subdirectories = named surfaces)
  const handlerPaths = await files(join(frondPath, 'handlers'));
  handlers.push(...await Promise.all(handlerPaths.map((f) => toHandlerEntry(f, entityByClassName, projectRoot))));

  const surfaceDirs = await dirs(join(frondPath, 'handlers'));
  for (const surfaceName of surfaceDirs) {
    const surfacePaths = await files(join(frondPath, 'handlers', surfaceName));
    handlers.push(...await Promise.all(surfacePaths.map((f) => toHandlerEntry(f, entityByClassName, projectRoot, surfaceName))));
  }

  // Scan presenters/
  const presenterPaths = await files(join(frondPath, 'presenters'));
  const presenterEntries = await Promise.all(presenterPaths.map((f) => toPresenterEntry(f)));
  presenters.push(...presenterEntries.filter((p): p is PresenterEntry => p !== null));

  // Scan collectors/
  const collectorPaths = await files(join(frondPath, 'collectors'));
  const collectorEntries = await Promise.all(collectorPaths.map((f) => toCollectorEntry(f)));
  collectors.push(...collectorEntries.filter((c): c is CollectorEntry => c !== null));

  // Scan seeds/
  const seedPaths = await files(join(frondPath, 'seeds'));
  const seedEntries = await Promise.all(seedPaths.map((f) => toSeedEntry(f)));
  seeds.push(...seedEntries.filter((s): s is SeedEntry => s !== null));

  // Mark exposed entries: frond.config.ts takes precedence, then @expose decorator
  const frondConfig = await loadFrondConfig(frondPath);
  if (frondConfig?.expose) {
    const exposeSet = new Set(frondConfig.expose);
    for (const e of entities) {
      e.exposed = exposeSet.has((e.entityClass as any).name);
    }
    for (const h of handlers) {
      h.exposed = exposeSet.has(h.ctor.name);
    }
  } else {
    // Fallback: check @expose decorator, default to true (expose everything unless explicitly hidden)
    for (const e of entities) {
      e.exposed = (e.entityClass as any).__exposed !== false;
    }
    for (const h of handlers) {
      h.exposed = (h.ctor as any).__exposed !== false;
    }
  }

  // Flatten per-op config overrides: resolve class refs to their class names (for DI lookup)
  const operationsOverrides = frondConfig?.operations
    ? Object.fromEntries(
        Object.entries(frondConfig.operations).map(([opName, override]) => [
          opName,
          {
            kind: override.kind,
            handlerName: override.handler ? (override.handler as any).name : undefined,
            method: override.method,
            policy: override.policy,
          },
        ]),
      )
    : undefined;

  return {
    name,
    source,
    providers,
    entities,
    handlers,
    presenters,
    collectors,
    seeds,
    surfaces: frondConfig?.surfaces,
    operationsOverrides,
  };
}

export async function scanProject(root: string, filter?: string[]): Promise<ScanResult> {
  setCacheRoot(root);

  const frondsDir = join(root, 'fronds');
  const names = await dirs(frondsDir);
  // Resolve workspace root (parent of packages/) for package import resolution
  // For monorepo: root is the project dir (e.g. demos/nuxt-blog), workspace root is the repo root
  const workspaceRoot = findWorkspaceRoot(root);

  const all = await Promise.all(
    names.map((n) => scanFrond(
      join(frondsDir, n), n,
      { path: join(frondsDir, n), package: `@frond/${n}` },
      workspaceRoot,
    )),
  );

  const fronds = filter ? all.filter((f) => filter.includes(f.name)) : all;

  flushCache();
  return { fronds };
}
