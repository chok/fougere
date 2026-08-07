import { readdir, readFile } from 'node:fs/promises';
import { existsSync, type Dirent } from 'node:fs';
import { join, dirname, basename, resolve as resolvePath } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { FrondDescriptor, ProviderEntry, EntityEntry, HandlerEntry, PresenterEntry, CollectorEntry, SeedEntry, ScanResult, ScanDiagnostic } from './types.js';
import { ANONYMOUS_SCHEMA_NAME, type SchemaLike } from '@fougere/schema';
import type { OperationContract, OperationsMap } from './operation.js';
import { cardinalityOf } from './operation.js';
import { parseAllHandlerMethods, parsePresenterMethods, parseConstructorParams, type ParsedType } from './handler-parser.js';
import { hashFile, getCached, setCached, flushCache, setCacheRoot } from './scan-cache.js';
import { loadFrondConfig } from './frond-config.js';
import { getPresenterTarget, getPresenterFields, getPresenterViews } from './presenter.js';
import { getRepositoryTarget } from './repository.js';
import { ormKeyOf } from './orm.js';
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

/**
 * What this scan run could not do. Reset by {@link scanProject}, which owns a run.
 *
 * Module-scoped like the loader and the cache root above: the scanner already has
 * a notion of "the current run", and threading a collector through twenty call
 * sites would state the same thing more loudly and less clearly.
 */
let diagnostics: ScanDiagnostic[] = [];

function record(d: ScanDiagnostic): void {
  diagnostics.push(d);
}

/**
 * An absent convention directory is the ordinary case — a frond without
 * `presenters/` is not a defect. Anything else (permissions, an I/O error, a path
 * that is not a directory) means the scan did not look, and answering `[]` says
 * it did. One `catch` used to conflate the two.
 */
async function readEntries(path: string): Promise<Dirent[]> {
  try {
    return await readdir(path, { withFileTypes: true });
  } catch (cause) {
    if ((cause as NodeJS.ErrnoException)?.code === 'ENOENT') return [];
    record({
      severity: 'blocking',
      code: 'directory-unreadable',
      filePath: path,
      // The path is NOT repeated here: `filePath` carries it, and a renderer that
      // prints both wraps an absolute path twice into an unreadable box.
      message: 'Could not read this directory — anything it declares is missing from '
        + 'the app, and nothing downstream can tell that from an empty directory.',
      cause,
    });
    return [];
  }
}

async function dirs(path: string): Promise<string[]> {
  const entries = await readEntries(path);
  return entries.filter((e) => e.isDirectory()).map((e) => e.name);
}

async function files(path: string): Promise<string[]> {
  const entries = await readEntries(path);
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

/** Directories whose classes register as providers — two spellings, one behaviour. */
const PROVIDER_DIRS = ['services', 'repositories'] as const;

/**
 * The frond vocabulary — every directory {@link scanFrond} reads. A frond directory says
 * nothing else, which is why this list is what a reader needs to bound one: the Nuxt
 * module watches these for the root frond (watching the root itself would match every
 * write), and a flat app's tsconfig lists them instead of `["."]`, which would swallow
 * `app/` and `nuxt.config.ts`.
 */
export const FROND_DIRS = [
  'entities', 'handlers', 'presenters', 'collectors', 'seeds', ...PROVIDER_DIRS,
] as const;

export { toRegistrationName } from './contract.js';
import { toRegistrationName } from './contract.js';

/** Strip 'Handler' suffix → entity name. 'PostHandler' → 'post'. */
function toEntityName(className: string): string {
  const base = className.endsWith('Handler') ? className.slice(0, -7) : className;
  return base[0].toLowerCase() + base.slice(1);
}

// Scan

/**
 * The container key a constructor parameter asks for — derived from its TYPE, not from
 * how the type was spelled.
 *
 * `deps` used to be `p.type.name`, so the key WAS the alias's name: `type ListOrm =
 * EntityOrm<List>` resolved only because someone had spelled it exactly like the
 * registration key (`ListOrm`), while `type ListRepo = EntityOrm<List>` — the same type —
 * typechecked and died at boot on `'ListRepo' is not registered`. And `EntityOrm<List>`
 * written out in full asked for `'EntityOrm'`, which nothing registers.
 *
 * `EntityOrm<X>` names X's storage, so that is the key. The generic argument was already
 * parsed (`ParsedType.generics`) and thrown away. Anything else keeps its own name: a
 * plain service IS designated by its class name.
 */
function depKeyOf(type: ParsedType): string {
  // `Facade<PostHandler>` — the second port, read exactly like the first. The type names
  // what arrives: not the handler (its methods take positional arguments and it is never
  // injected), but the door built in front of it. Same key whether that door is the local
  // façade or a doublure, which is what makes the topology invisible from a signature.
  const facadeOf = type.name === 'Facade' ? type.generics?.[0]?.name : undefined;
  if (facadeOf) return toRegistrationName(facadeOf);

  const target = type.name === 'EntityOrm' ? type.generics?.[0]?.name : undefined;
  if (!target) return type.name;

  return ormKeyOf(target);
}

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

async function toProvider(filePath: string): Promise<ProviderEntry> {
  const ctor = await loadClass(filePath);
  const params = await cachedCtorParams(filePath);
  const deps = params.map((p) => depKeyOf(p.type));

  // A repository inherits its constructor from `Repository(Entity)`, so the file
  // declares none and the scan reads no parameter. The mixin knows which entity it
  // was built for and says so at runtime — same escape as `Crud.__ops`, and the same
  // reason: what a prefab fabricates, only the prefab can describe.
  const target = getRepositoryTarget(ctor);
  if (target && deps.length === 0) {
    deps.push(`${toRegistrationName((target as { name: string }).name).replace(/^./, (c) => c.toUpperCase())}Orm`);
  }

  return { name: toRegistrationName(ctor.name), ctor, deps, filePath };
}

async function toEntityEntry(filePath: string): Promise<EntityEntry | null> {
  const exported = await loadDefault(filePath);
  if (!isEntityClass(exported)) return null;
  const runtimeName = (exported as { name?: string }).name;
  // A derivation returned directly (`export default User.extend(...)`) carries the
  // factory's own name, which the schema package stamps and exports. The file is then
  // the declaration site and therefore the only name the author actually supplied;
  // named classes keep winning.
  const declaredName = runtimeName && runtimeName !== ANONYMOUS_SCHEMA_NAME
    ? runtimeName
    : basename(filePath).replace(/\.[^.]+$/, '');
  const name = toRegistrationName(declaredName);
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
  } catch (cause) {
    // The handler still gets a façade — its methods exist at runtime — but with no
    // contract: no binding plan, no input schema, no doc sentence. It used to
    // return the empty map, so the app served a stranger's idea of the handler and
    // said nothing. The operations are gone; the sentence saying so is not.
    record({
      severity: 'blocking',
      code: 'handler-parse-failed',
      filePath,
      message: 'Could not parse this handler — its operations carry no contract, so the '
        + 'façade serves them unbound. Not the same as a handler with no operation.',
      cause,
    });
    return map;
  }

  /**
   * A base class the parse could not open — an installed package, typically, whose
   * source is not in the workspace. Its operations are missing from this façade, and
   * the scan cannot tell whether there were any.
   *
   * A warning, not a refusal: an installed base class with no operation is perfectly
   * ordinary, and the boot has no way to decide between the two. So it names the
   * clause and stops there. Stating the contract in `frond.config.ts` is the answer
   * — the third producer, which creates an op neither other producer found — and it
   * silences this by making the op exist.
   */
  for (const base of parsed.unresolvedHeritage) {
    record({
      severity: 'warning',
      code: 'heritage-unresolved',
      filePath,
      message: `Could not resolve 'extends ${base}' — any operation it declares is absent `
        + `from this façade, and the scan cannot tell that from a base class with none. `
        + `State the contract in frond.config.ts to put it back.`,
    });
  }

  for (const method of parsed.methods) {
    // The contract is what carries the description; `signature` is the raw material it
    // was read from. Leaving it only on the signature meant every consumer had to know
    // to look one level down, and only the façade did.
    const meta: OperationContract = {
      signature: method,
      ...(method.description && { description: method.description }),
    };

    // Resolve schemas for all params
    for (const param of method.params) {
      const schema = resolveSchema(param.type, moduleExports);
      if (schema && !meta.input) meta.input = schema;
    }

    if (method.returnType) {
      meta.output = resolveSchema(method.returnType, moduleExports);
      // `output` is the shape of one row; this says how many rows come back.
      meta.cardinality = cardinalityOf(method.returnType);
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
  const deps = ctorParams.map((p) => depKeyOf(p.type));

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
  const deps = presenterParams.map((p) => depKeyOf(p.type));

  // Parse method return types from source
  let fieldMeta: PresenterEntry['fieldMeta'] = [];
  try {
    const parsed = await cachedPresenterMethods(filePath);
    fieldMeta = parsed.map((m) => ({
      name: m.name,
      returnType: m.returnType?.name,
      // One array level IS the page — the method answers one value per row. What is left
      // over is the field's own arity: `string[]` a scalar per row, `string[][]` a list.
      list: (m.returnType?.arrayDepth ?? 0) > 1,
      nullable: m.returnType?.nullable,
      // Everything after the rows is bound like a handler's argument.
      params: m.params.slice(1),
    }));
  } catch { /* parse failure — fall back to untyped */ }

  // Declared at runtime on the class, so it survives a scan that resolved nothing.
  return { entityName, ctor, fields, fieldMeta, views: getPresenterViews(ctor), deps, filePath };
}

async function toCollectorEntry(filePath: string): Promise<CollectorEntry | null> {
  const ctor = await loadClass(filePath);
  const target = getCollectorTarget(ctor);
  if (!target) return null;
  const entityName = toRegistrationName((target as any).name);
  const collectorParams = await cachedCtorParams(filePath);
  const deps = collectorParams.map((p) => depKeyOf(p.type));
  return { entityName, ctor, deps, filePath };
}

async function scanFrond(frondPath: string, name: string, source: FrondDescriptor['source'], projectRoot?: string): Promise<FrondDescriptor> {
  const providers: ProviderEntry[] = [];
  const entities: EntityEntry[] = [];
  const handlers: HandlerEntry[] = [];
  const presenters: PresenterEntry[] = [];
  const collectors: CollectorEntry[] = [];
  const seeds: SeedEntry[] = [];

  // Scan services/ and repositories/ — both land in the same provider list.
  for (const dir of PROVIDER_DIRS) {
    const paths = await files(join(frondPath, dir));
    providers.push(...await Promise.all(paths.map((f) => toProvider(f))));
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

  // Flatten per-op config overrides: the only thing that needs flattening is the handler
  // CLASS, which becomes its name (that is the DI key). Everything else — the surface keys
  // AND the contract keys (`input`, `binding`) — travels verbatim, so a slot added to
  // OperationOverride reaches its reader without a stop here. Enumerating keys by hand is
  // what used to silently drop whatever was added last (the same invariant `cloneField`
  // holds one layer down).
  const operationsOverrides = frondConfig?.operations
    ? Object.fromEntries(
        Object.entries(frondConfig.operations).map(([opName, { handler, ...rest }]) => [
          opName,
          { ...rest, handlerName: handler?.name },
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

/**
 * The frond's name — the directory, unless its `package.json` renames it. One rule for a
 * frond under `fronds/` and for the root frond alike, so the root needs no second spelling.
 *
 * Carrying the convention is what makes a frond; the key never marked anything and
 * nothing read it. It earns its keep as the one thing the directory cannot say: that
 * `fronds/blog-v2/` serves the frond still called `blog` — so a rename on disk does not
 * rename the entity keys, the `@frond/*` import or a `remotes:` entry.
 */
async function frondNameOf(frondPath: string, dirName: string): Promise<string> {
  try {
    const pkg = JSON.parse(await readFile(join(frondPath, 'package.json'), 'utf8')) as {
      fougere?: { frond?: unknown };
    };
    const declared = pkg.fougere?.frond;
    return typeof declared === 'string' && declared.length > 0 ? declared : dirName;
  } catch {
    return dirName;
  }
}

/**
 * A frond is a directory carrying the convention, and the project root is one such
 * directory — so a single-domain app writes `entities/` next to `app/` and never names
 * anything. `fronds/` is not the definition, it is where the OTHERS live: the root frond
 * stays put when a second domain appears, which is what makes flattening free instead of
 * a deferred move.
 *
 * `entities/` is the test, not "any convention directory". `services/` and `repositories/`
 * are ordinary top-level names in projects that never heard of Fougere, and a domain
 * without a single entity is not a domain.
 */
async function rootFrondOf(root: string, workspaceRoot: string): Promise<FrondDescriptor | null> {
  if ((await files(join(root, 'entities'))).length === 0) return null;
  const name = await frondNameOf(root, basename(resolvePath(root)));
  return scanFrond(root, name, { path: root, package: `@frond/${name}` }, workspaceRoot);
}

export async function scanProject(root: string, filter?: string[]): Promise<ScanResult> {
  setCacheRoot(root);
  // A run owns its findings: two scans in one process (a test suite, a watcher)
  // must not inherit each other's.
  diagnostics = [];

  const frondsDir = join(root, 'fronds');
  const dirNames = await dirs(frondsDir);
  // Resolve workspace root (parent of packages/) for package import resolution
  // For monorepo: root is the project dir (e.g. demos/nuxt-blog), workspace root is the repo root
  const workspaceRoot = findWorkspaceRoot(root);

  const [rootFrond, under] = await Promise.all([
    rootFrondOf(root, workspaceRoot),
    Promise.all(
      dirNames.map(async (dir) => {
        const name = await frondNameOf(join(frondsDir, dir), dir);
        return scanFrond(
          join(frondsDir, dir), name,
          { path: join(frondsDir, dir), package: `@frond/${name}` },
          workspaceRoot,
        );
      }),
    ),
  ]);

  // The app's own domain first, then the ones it took in.
  const all = rootFrond ? [rootFrond, ...under] : under;
  const fronds = filter ? all.filter((f) => filter.includes(f.name)) : all;

  flushCache();
  return { fronds, diagnostics };
}
