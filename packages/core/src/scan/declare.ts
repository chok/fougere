/**
 * A frond stated by its author, for an app that will not scan.
 *
 * The scan reads the type checker because a signature IS a declaration — and that reading
 * has to happen while the types still exist, which is build time. An app that wants
 * neither a build step nor `typescript` at runtime says the same thing here instead, and
 * `createApp` cannot tell the difference: it consumes a `ScanResult`, never a scanner.
 *
 * What it does NOT ask for is the point. Every name the scan derives from a class is
 * derived here the same way — `PostHandler` answers at `post`, `Post` is stored as `post`
 * — so a declaration states classes and nothing else. `filePath` is empty because there is
 * no file to point at, and a diagnostic that would have quoted one says so plainly.
 *
 * Measured on `demos/nuxt-blog`: 23 of its 29 operations need no word here at all, because
 * `Crud.__ops` declares them at runtime. Only the six the author wrote by hand cost
 * anything, and they cost `frond.config.ts` — where what is not derivable is stated.
 */
import { lowerFirst, type SchemaView } from '@fougere/schema';
import type {
  CollectorEntry, EntityEntry, FrondDescriptor, HandlerEntry,
  PresenterEntry, ProviderEntry, SeedEntry,
} from './frond.js';
import { DEFAULT_CONVENTIONS } from './conventions.js';

/** A class, as a declaration hands it over: the constructor itself. */
type Ctor = new (...args: never[]) => unknown;

/**
 * What a subject needs beyond its class, when its constructor names a frame or a port.
 *
 * `deps` is the one thing no runtime can recover: TypeScript erases the parameter types,
 * and `registerFrames` reads them to know which frames to build — asking for one IS
 * declaring it. A handler that takes only its own entity's ORM needs nothing here.
 */
export interface DeclaredSubject {
  ctor: Ctor;
  deps?: string[];
}

/** A class on its own, or a class with what it asks for. */
export type Declared = Ctor | DeclaredSubject;

const ctorOf = (d: Declared): Ctor => (typeof d === 'function' ? d : d.ctor);
const depsOf = (d: Declared): string[] => (typeof d === 'function' ? [] : d.deps ?? []);

/** `PostHandler` answers at `post` — the same rule the scan applies to a file it found. */
function addressOf(className: string): string {
  const base = className.endsWith('Handler') ? className.slice(0, -7) : className;

  return lowerFirst(base);
}

/** What a declaration states about one frond. Everything else is derived from the classes. */
export interface FrondDeclaration {
  entities?: SchemaView[];
  handlers?: Declared[];
  presenters?: (DeclaredSubject & { entityName: string; fields: string[] })[];
  collectors?: (DeclaredSubject & { typeName: string })[];
  providers?: Declared[];
  seeds?: { entityName: string; data: SeedEntry['data'] }[];
  /** Per-surface entity lists — the same key `frond.config.ts` states. */
  surfaces?: Record<string, string[]>;
  /** The import scope this frond answers under. Defaults to the conventional one. */
  scope?: string;
}

/**
 * State a frond without reading a disk.
 *
 * ```ts
 * createApp({
 *   scan: { fronds: Fronds.scanned([frond('blog', { entities: [Post], handlers: [PostHandler] })]), diagnostics: [] },
 * })
 * ```
 */
export function frond(name: string, declared: FrondDeclaration = {}): FrondDescriptor {
  const scope = declared.scope ?? DEFAULT_CONVENTIONS.scope;

  const entities: EntityEntry[] = (declared.entities ?? []).map((entityClass) => ({
    name: lowerFirst((entityClass as { name: string }).name),
    entityClass,
    filePath: '',
    exposed: true,
  }));

  const handlers: HandlerEntry[] = (declared.handlers ?? []).map((h) => {
    const ctor = ctorOf(h);
    const address = addressOf(ctor.name);

    return {
      name: ctor.name,
      address,
      ctor,
      // A handler about no stored row is ordinary — the address is not a promise that an
      // entity carries it, which is why this is not looked up.
      entityName: address,
      operations: new Map(),
      deps: depsOf(h),
      filePath: '',
      exposed: true,
    };
  });

  const presenters: PresenterEntry[] = (declared.presenters ?? []).map((p) => ({
    entityName: p.entityName,
    ctor: p.ctor,
    fields: p.fields,
    fieldMeta: p.fields.map((field) => ({ name: field })),
    deps: p.deps ?? [],
    filePath: '',
  }));

  const collectors: CollectorEntry[] = (declared.collectors ?? []).map((c) => ({
    typeName: c.typeName,
    ctor: c.ctor,
    deps: c.deps ?? [],
    filePath: '',
  }));

  const providers: ProviderEntry[] = (declared.providers ?? []).map((p) => ({
    ctor: ctorOf(p),
    deps: depsOf(p),
    filePath: '',
  }));

  const seeds: SeedEntry[] = (declared.seeds ?? []).map((s) => ({
    entityName: s.entityName,
    data: s.data,
    filePath: '',
  }));

  return {
    name,
    source: { path: '', package: `${scope}/${name}` },
    providers,
    entities,
    handlers,
    presenters,
    collectors,
    seeds,
    ...(declared.surfaces ? { surfaces: declared.surfaces } : {}),
  };
}
