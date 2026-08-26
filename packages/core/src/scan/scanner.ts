import { readdir, readFile } from 'node:fs/promises';
import { existsSync, type Dirent } from 'node:fs';
import { join, dirname, basename, resolve as resolvePath } from 'node:path';
import type { FrondDescriptor, ProviderEntry, EntityEntry, HandlerEntry, PresenterEntry, CollectorEntry, SeedEntry, ScanResult, ScanDiagnostic } from './frond.js';
import { ANONYMOUS_SCHEMA_NAME, type SchemaView } from '@fougere/schema';
import type { OperationContract, OperationsMap } from '../wire/operation.js';
import { cardinalityOf } from '../wire/operation.js';
import { computeBindingPlan } from '../boot/binding.js';
import {
  parseAllHandlerMethods,
  parsePresenterMethods,
  parseConstructorParams,
  resetTypePrograms,
  seedTypeProgram,
  type ParsedType,
} from './handler-parser.js';
import { loadFrondConfig } from '../frond-config.js';
import { emitKeyOf } from '../emit.js';
import { getPresenterFields } from '../prefab/presenter.js';
import { ormKeyOf, togetherKeyOf } from '../orm.js';
import { targetOf, viewsOf, outputOf } from '../prefab/prefab.js';
import { ownedBy, repositoryKeyOf } from '../prefab/repository.js';
import { lowerFirst } from '@fougere/schema';
import { Fronds } from './Fronds.js';
import { getModuleLoader } from '../loader.js';
import {
  type Conventions, type ConventionsInput,
  DEFAULT_CONVENTIONS, resolveConventions, frondPackage, providerDirsOf, frondDirsOf,
} from './conventions.js';

// FS

/**
 * What this scan run could not do. Reset by {@link scanProject}, which owns a run.
 *
 * Module-scoped like the loader and the cache root above: the scanner already has a
 * notion of "the current run". Three sites record — measured — so a per-run object
 * would carry twenty methods to spare one line of reset.
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
  return await getModuleLoader()(filePath);
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

function isEntityClass(value: unknown): value is SchemaView {
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

/**
 * Strip the 'Handler' suffix → the name the handler answers to. 'PostHandler' → 'post'.
 *
 * Nothing here checks that an entity carries the result, and nothing should: a handler
 * about no stored row is ordinary. The old name of this function — `toEntityName` — is
 * what let "one façade per entity" be repeated until it read as a rule.
 */
function toAddress(className: string): string {
  const base = className.endsWith('Handler') ? className.slice(0, -7) : className;
  return lowerFirst(base);
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
  if (facadeOf) return lowerFirst(facadeOf);

  // `Emit<PostPublished>` — the third port, and the only one that names a SUBJECT rather
  // than an interlocutor. Read like the other two: the type names what arrives, here a
  // function that announces. Who receives it is not in the signature and never will be.
  const factOf = type.name === 'Emit' ? type.generics?.[0]?.name : undefined;
  if (factOf) return emitKeyOf(factOf);

  // `Together<[Account, Ledger], [RateMirror]>` — the fifth reading, and the only one whose
  // argument is a SET rather than one subject. The AST hands each tuple back as a single
  // string, so they are split here, where every other question of "how was it written" lives.
  const frame = type.name === 'Together' ? type.generics?.[0]?.name : undefined;
  if (frame) return togetherKeyOf(tupleMembers(frame), tupleMembers(type.generics?.[1]?.name ?? ''));

  // `RepositoryOf<Post>` — what an author writes when no repository file exists. The dual
  // of the line below: one names the port, the other the holder, and both resolve to a key
  // rather than to a class the author would have to invent.
  const held = type.name === 'RepositoryOf' ? type.generics?.[0]?.name : undefined;
  if (held) return repositoryKeyOf(held);

  const target = type.name === 'EntityOrm' ? type.generics?.[0]?.name : undefined;
  if (!target) return type.name;

  return ormKeyOf(target);
}

/**
 * `'[Account, Ledger]'` → `['Account', 'Ledger']`.
 *
 * The tuple was chosen over the variadic form the parser reads more cleanly, because the
 * variadic one costs arities-with-defaults and a `never` filter on the TypeScript side
 * while the tuple maps to `[EntityOrm<Account>, EntityOrm<Ledger>]` in one line. The
 * parser does not get to decide alone; this split is what that choice costs.
 */
function tupleMembers(raw: string): string[] {
  return raw.replace(/^\[|\]$/g, '').split(',').map((member) => member.trim()).filter(Boolean);
}

/**
 * These readings are semantic: an unchanged file can mean something different after an
 * imported alias changes. The parser's TypeScript Program is the cache for one scan; a
 * cache keyed only by this file's bytes would be unsound.
 */
const ctorParamsOf = (filePath: string) =>
  parseConstructorParams(filePath);

const presenterMethodsOf = (filePath: string) =>
  parsePresenterMethods(filePath);

const handlerMethodsOf = (filePath: string, projectRoot?: string) =>
  parseAllHandlerMethods(filePath, projectRoot);

async function toProvider(filePath: string): Promise<ProviderEntry> {
  const ctor = await loadClass(filePath);
  const params = await ctorParamsOf(filePath);
  const deps = params.map((p) => depKeyOf(p.type));

  // A repository inherits its constructor from `Repository(…)`, so the file declares none
  // and the scan reads no parameter. The mixin knows what it was built for and says so at
  // runtime — same escape as `Crud.__ops`, and the same reason: what a prefab fabricates,
  // only the prefab can describe.
  //
  // An AGGREGATE owns several, and its base takes them in the declared order. It is handed
  // no frame: the boundary and the unit of work are two statements, and a frame is ASKED FOR
  // like anywhere else — see `prefab/repository.ts`.
  const owned = ownedBy(ctor);
  const target = targetOf(ctor);
  if (owned.length > 1 && deps.length === 0) {
    deps.push(...owned.map((entity) => ormKeyOf(lowerFirst((entity as { name: string }).name))));
  } else if (target && deps.length === 0) {
    deps.push(ormKeyOf(lowerFirst((target as { name: string }).name)));
  }

  // No `name` beside `ctor`: a provider registers under `ctor.name`, which is what
  // `depKeyOf` returns since it reads the type as written. The camelCase field that
  // used to sit here called itself the registration key and was one nowhere.
  return { ctor, deps, filePath };
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
  const name = lowerFirst(declaredName);
  return { name, entityClass: exported, filePath };
}

/**
 * Resolve a ParsedType to a runtime schema if available in module exports.
 * Handles arrays, generics (uses base name), and simple references.
 */
function resolveSchema(type: ParsedType, moduleExports: Record<string, unknown>): SchemaView | undefined {
  // An array's element type IS `type.name` — the arity rides beside it, so nothing has
  // to be unwrapped here.
  // For generics like Pagination<Post>, also check inner types
  if (type.generics) {
    for (const g of type.generics) {
      const resolved = moduleExports[g.name];
      if (resolved && typeof resolved === 'function' && 'getFields' in resolved) {
        // `Partial<X>` in a signature IS the patch declaration (Crud.update) —
        // project it onto the schema view instead of dropping the wrapper, so
        // the facade validates in patch mode (absent field → untouched).
        if (type.name === 'Partial' && 'partial' in resolved && typeof (resolved as any).partial === 'function') {
          return (resolved as any).partial() as SchemaView;
        }
        return resolved as unknown as SchemaView;
      }
    }
  }
  const resolved = moduleExports[type.name];
  if (resolved && typeof resolved === 'function' && 'getFields' in resolved) {
    return resolved as unknown as SchemaView;
  }
  return undefined;
}

/**
 * Parse ALL method signatures for unified binding.
 *
 * Resolves schemas for all params (not just the first) and stores
 * full signatures for the binding algorithm.
 */
async function inferOperations(
  filePath: string,
  handlerName: string,
  moduleExports: Record<string, unknown>,
  collectorTypeNames: Set<string>,
  explicitInputs: ReadonlySet<string>,
  declared: Record<string, OperationContract>,
  projectRoot?: string,
): Promise<OperationsMap> {
  const map = new Map<string, OperationContract>();
  let parsed: Awaited<ReturnType<typeof parseAllHandlerMethods>>;
  try {
    parsed = await handlerMethodsOf(filePath, projectRoot);
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

    // A convention may omit a declaration only when it has one answer. Only values the
    // caller supplies through the body are candidates: a schema-typed collector, fact or
    // context parameter is not input merely because it names an entity. The old loop
    // ignored provenance and assigned the first schema it met, so swapping two parameters
    // silently changed the contract the façade used to judge the request body.
    const binding = computeBindingPlan(method.params, collectorTypeNames);
    const candidates = method.params.flatMap((param, index) => {
      if (binding[index]?.source.kind !== 'body') return [];
      const schema = resolveSchema(param.type, moduleExports);
      return schema ? [{ param, schema }] : [];
    });
    if (candidates.length === 1) {
      meta.input = candidates[0].schema;
    } else if (
      candidates.length > 1
      && declared[method.name]?.input === undefined
      && !explicitInputs.has(method.name)
    ) {
      const subject = `${handlerName}.${method.name}`;
      record({
        severity: 'blocking',
        code: 'input-contract-ambiguous',
        filePath,
        subject,
        message: `Cannot infer the input contract for ${subject}: ${candidates.length} entity `
          + `candidates — ${candidates.map(({ param }) => `${param.name}: ${param.type.raw}`).join('; ')}. `
          + `Declare operations.${method.name}.input in frond.config.ts.`,
      });
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
  entityByClassName: Map<string, SchemaView>,
  collectorTypeNames: Set<string>,
  explicitInputs: ReadonlySet<string>,
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

  const address = toAddress(ctor.name);
  const declaredOps = (ctor as { __ops?: Record<string, OperationContract> }).__ops ?? {};
  const operations = await inferOperations(
    filePath,
    ctor.name,
    augmented,
    collectorTypeNames,
    explicitInputs,
    declaredOps,
    projectRoot,
  );
  const ctorParams = await ctorParamsOf(filePath);
  const deps = ctorParams.map((p) => depKeyOf(p.type));

  // Read output override from Crud(Entity, Output) — static __output property
  // A handler-wide view, when it is not simply the entity — the two are compared by
  // identity, which is why both slots are read through the same door.
  const subject = targetOf(ctor);
  const declared = outputOf(ctor);
  const outputOverride = declared && subject && declared !== subject
    ? (declared as unknown as SchemaView)
    : undefined;

  return {
    name: lowerFirst(ctor.name),
    address,
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
  return lowerFirst(base);
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
  const target = targetOf(ctor);
  if (!target) return null;
  const entityName = lowerFirst((target as any).name);
  const fields = getPresenterFields(ctor);
  const presenterParams = await ctorParamsOf(filePath);
  const deps = presenterParams.map((p) => depKeyOf(p.type));

  // Parse method return types from source
  let fieldMeta: PresenterEntry['fieldMeta'] = [];
  try {
    const parsed = await presenterMethodsOf(filePath);
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

    // The rows parameter is stripped just above, and nothing used to check its SHAPE.
    // A computed field receives the PAGE and answers one value per row, so a method
    // written `items(order: Order)` compiles and dies at the first call with a 500
    // (`expected 1 value(s) for 1 row(s), got 0`) — while the information sat here, at
    // the scan. Every own method of a presenter IS a computed field
    // (`getPresenterFields`), so there is no private helper to spare.
    //
    // An ERROR at boot, not a refusal: a `blocking` scan diagnostic is logged and the
    // app still starts (`bootstrap.ts`, and the comment above that loop says why). Making
    // it refuse means deciding that a declaration which cannot work is an unresolved
    // CONTRACT — the one thing that does stop the boot — and that is a decision, not a
    // severity.
    for (const method of parsed) {
      const rows = method.params[0];
      if (rows && rows.type.array === true) continue;
      record({
        severity: 'blocking',
        code: 'presenter-field-not-page',
        filePath,
        subject: `${(ctor as { name?: string }).name ?? 'Presenter'}.${method.name}`,
        message: `${method.name}(${rows ? `${rows.name}: ${rows.type.raw}` : ''}) is a computed `
          + `field, so it receives the PAGE and must answer one value per row. Declare `
          + `${method.name}(${rows?.name ?? 'rows'}: ${(target as { name?: string }).name ?? 'Entity'}[]) `
          + `and return an array of the same length.`,
      });
    }
  } catch { /* parse failure — fall back to untyped */ }

  // Declared at runtime on the class, so it survives a scan that resolved nothing.
  return { entityName, ctor, fields, fieldMeta, views: viewsOf(ctor), deps, filePath };
}

async function toCollectorEntry(filePath: string): Promise<CollectorEntry | null> {
  const ctor = await loadClass(filePath);
  const target = targetOf(ctor);
  if (!target) return null;
  // The target's NAME and nothing else — a collector reads no fields, so the class it
  // was built on needs no schema.
  const typeName = lowerFirst((target as any).name);
  const collectorParams = await ctorParamsOf(filePath);
  const deps = collectorParams.map((p) => depKeyOf(p.type));
  return { typeName, ctor, deps, filePath };
}

async function scanFrond(frondPath: string, name: string, source: FrondDescriptor['source'], conventions: Conventions, projectRoot?: string): Promise<FrondDescriptor> {
  const {
    entities: entitiesDir, handlers: handlersDir,
    presenters: presentersDir, collectors: collectorsDir, seeds: seedsDir,
  } = conventions.dirs;
  /**
   * A convention directory, read by whoever knows the shape it holds.
   *
   * The same three lines were written six times — list, read in parallel, drop what the
   * reader refused — which is what made `handlers/` quietly special: it grew a second
   * pass for its surfaces and nothing else could.
   */
  const collect = async <T extends object>(
    dir: string,
    read: (filePath: string) => Promise<T | null>,
  ): Promise<T[]> => {
    const entries: (T | null)[] = await Promise.all((await files(join(frondPath, dir))).map(read));
    return entries.filter((entry): entry is T => entry !== null);
  };

  // services/ and repositories/ — two spellings, one provider list.
  const providers = (await Promise.all(providerDirsOf(conventions).map((dir) => collect(dir, toProvider)))).flat();
  const entities = await collect(entitiesDir, toEntityEntry);
  const collectors = await collect(collectorsDir, toCollectorEntry);
  const collectorTypeNames = new Set(collectors.map((collector) => collector.typeName));
  const frondConfig = await loadFrondConfig(frondPath);
  const explicitInputs = new Set(
    Object.entries(frondConfig?.operations ?? {})
      .filter(([, contract]) => contract.input !== undefined)
      .map(([operation]) => operation),
  );

  // Handlers resolve `T` against the entities, so those come first.
  const entityByClassName = new Map(
    entities.map((e) => [(e.entityClass as { name: string }).name, e.entityClass]),
  );
  const handlers = await collect(handlersDir, (f) =>
    toHandlerEntry(f, entityByClassName, collectorTypeNames, explicitInputs, projectRoot));

  // A subdirectory of handlers/ is a named surface — the one directory whose CHILDREN
  // are part of the convention too.
  for (const surface of await dirs(join(frondPath, handlersDir))) {
    handlers.push(...await collect(join(handlersDir, surface), (f) =>
      toHandlerEntry(f, entityByClassName, collectorTypeNames, explicitInputs, projectRoot, surface)));
  }

  const presenters = await collect(presentersDir, toPresenterEntry);
  const seeds = await collect(seedsDir, toSeedEntry);

  // Mark exposed entries: frond.config.ts takes precedence, then @expose decorator
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
    reads: frondConfig?.reads,
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
 * rename the entity keys, the `@fronds/*` import or a `remotes:` entry.
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
async function rootFrondOf(root: string, workspaceRoot: string, conventions: Conventions): Promise<FrondDescriptor | null> {
  if ((await files(join(root, conventions.dirs.entities))).length === 0) return null;
  const name = await frondNameOf(root, basename(resolvePath(root)));
  return scanFrond(root, name, { path: root, package: frondPackage(name, conventions) }, conventions, workspaceRoot);
}

/**
 * `@fronds/<name>` → the directory it names, for every frond of a project.
 *
 * The framework states this convention — `FrondSource.package` has always spelled it, and
 * `fougere sync` writes it into a consumer's tsconfig — and until now its own reader could
 * not resolve it. The Nuxt module registered a Vite alias, so a `.vue` page could import
 * `@fronds/blog/entities/Post`, while the SCAN loaded sources through a bare jiti: a frond
 * naming its neighbour got `Cannot find module '@fronds/user/entities/User.js'`. So the one
 * form that survives a split was the one form that did not run.
 *
 * Hand it to the module loader — `createJiti(url, { alias: await frondAliases(root) })` —
 * and the named form resolves everywhere the framework reads. A directory listing and a
 * `package.json` read, no parsing: it is deliberately callable BEFORE the loader exists,
 * which is what makes the chicken-and-egg go away.
 */
export async function frondAliases(root: string, conventions: Conventions = DEFAULT_CONVENTIONS): Promise<Record<string, string>> {
  const frondsDir = join(root, conventions.fronds);
  const aliases: Record<string, string> = {};

  // The root itself is a frond when it carries `entities/` — same rule as the scan.
  if ((await files(join(root, conventions.dirs.entities))).length > 0) {
    aliases[frondPackage(await frondNameOf(root, basename(resolvePath(root))), conventions)] = resolvePath(root);
  }
  for (const dir of await dirs(frondsDir)) {
    const path = join(frondsDir, dir);
    aliases[frondPackage(await frondNameOf(path, dir), conventions)] = resolvePath(path);
  }

  /**
   * A SYNCED frond answers to the same name.
   *
   * `fougere sync` writes `.fougere/remotes/<name>/` and registers it in `remotes.json`,
   * which the Nuxt module already reads to alias `@fronds/<name>`. Doing it here too is
   * what makes the convention mean ONE thing: a consumer writes `@fronds/blog/entities/Post`
   * and never learns whether that frond is on this disk or was fetched from a card.
   *
   * A local frond wins a name collision — its source is the truth, a synced copy is a
   * mirror of somebody else's.
   */
  try {
    const registry = JSON.parse(
      await readFile(join(root, '.fougere', 'remotes.json'), 'utf8'),
    ) as Record<string, { path?: string }>;
    for (const [name, entry] of Object.entries(registry)) {
      if (typeof entry?.path !== 'string' || aliases[frondPackage(name, conventions)]) continue;
      aliases[frondPackage(name, conventions)] = resolvePath(entry.path);
    }
  } catch {
    // No registry, or an unreadable one: nothing was synced here. Not this function's
    // complaint — `sync` owns that file and reports on it.
  }

  return aliases;
}

export async function scanProject(
  root: string,
  filter?: string[],
  conventionsInput?: ConventionsInput,
): Promise<ScanResult> {
  const conventions = resolveConventions(conventionsInput);
  resetTypePrograms();
  // A run owns its findings: two scans in one process (a test suite, a watcher)
  // must not inherit each other's.
  diagnostics = [];

  const frondsDir = join(root, conventions.fronds);
  const dirNames = await dirs(frondsDir);
  // Resolve workspace root (parent of packages/) for package import resolution
  // For monorepo: root is the project dir (e.g. demos/nuxt-blog), workspace root is the repo root
  const workspaceRoot = findWorkspaceRoot(root);

  // One program for this run. Seeded here because the parser rebuilds on every root it
  // has not seen, and a frond lives outside its project's tsconfig `include`. Both keys
  // are seeded: heritage reads under the workspace root, a constructor under none.
  const declarations = (await Promise.all(
    [root, ...dirNames.map((dir) => join(frondsDir, dir))].flatMap((frondPath) =>
      frondDirsOf(conventions).map((dir) => files(join(frondPath, dir)))),
  )).flat();
  await seedTypeProgram(declarations, workspaceRoot);
  await seedTypeProgram(declarations);

  const [rootFrond, under] = await Promise.all([
    rootFrondOf(root, workspaceRoot, conventions),
    Promise.all(
      dirNames.map(async (dir) => {
        const name = await frondNameOf(join(frondsDir, dir), dir);
        return scanFrond(
          join(frondsDir, dir), name,
          { path: join(frondsDir, dir), package: frondPackage(name, conventions) },
          conventions,
          workspaceRoot,
        );
      }),
    ),
  ]);

  // The app's own domain first, then the ones it took in.
  const all = rootFrond ? [rootFrond, ...under] : under;
  const fronds = Fronds.scanned(filter ? all.filter((f) => filter.includes(f.name)) : all);

  return { fronds, diagnostics };
}
