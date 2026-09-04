/** A frond stated by its author, for an app that will not scan. */
import { lowerFirst, type SchemaView } from '@fougere/schema';
import type {
  CollectorEntry, EntityEntry, FrondDescriptor, HandlerEntry,
  PresenterEntry, ProviderEntry, SeedEntry,
} from './descriptor/frond.js';
import { DEFAULT_CONVENTIONS } from './scan/conventions.js';
import { getPresenterFields } from './prefab/presenter.js';

/** A class, as a declaration hands it over: the constructor itself. */
type Ctor = new (...args: never[]) => unknown;

/** What a subject needs beyond its class, when its constructor names a frame or a port. */
export interface DeclaredSubject {
  ctor: Ctor;
  deps?: string[];
}

/** A handler, and the surface it answers on when it is not the default one. */
export interface DeclaredHandler extends DeclaredSubject {
  /**
   * The scan reads this from the directory (`handlers/public/`), so a statement has to say it: two
   * handlers over one entity collide on their address otherwise, and the refusal names the same
   * route twice.
   */
  surface?: string;
}

/** A class on its own, or a class with what it asks for. */
export type Declared = Ctor | DeclaredSubject;

const ctorOf = (d: Declared): Ctor => (typeof d === 'function' ? d : d.ctor);

/**
 * What a prefab was BUILT ON — `Presenter(Post)` and `Collector(User)` both keep it under
 * `__entity`, which is the only place it survives: nothing in the FORM of `PostPresenter` says
 * `Post`.
 */
function subjectOf(ctor: Ctor, kind: string): { name: string } {
  const subject = (ctor as unknown as { __entity?: { name: string } }).__entity;
  if (!subject?.name) {
    throw new Error(
      `${ctor.name} is declared as a ${kind} but does not extend ${kind === 'presenter' ? 'Presenter(Entity)' : 'Collector(Type)'}, `
      + `so what it is about cannot be read.`,
    );
  }

  return subject;
}
const depsOf = (d: Declared): string[] => (typeof d === 'function' ? [] : d.deps ?? []);

/** `PostHandler` answers at `post` — the same rule the scan applies to a file it found. */
function addressOf(className: string): string {
  const base = className.endsWith('Handler') ? className.slice(0, -7) : className;

  return lowerFirst(base);
}

/** What a declaration states about one frond. Everything else is derived from the classes. */
export interface FrondDeclaration {
  entities?: SchemaView[];
  handlers?: (Ctor | DeclaredHandler)[];
  presenters?: (Ctor | DeclaredSubject)[];
  collectors?: (Ctor | DeclaredSubject)[];
  providers?: Declared[];
  seeds?: { entityName: string; data: SeedEntry['data'] }[];
  /** Per-surface entity lists — the same key `frond.config.ts` states. */
  surfaces?: Record<string, string[]>;
  /** The import scope this frond answers under. Defaults to the conventional one. */
  scope?: string;
}

/** State a frond without reading a disk. */
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
    const surface = typeof h === 'function' ? undefined : h.surface;
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
      ...(surface ? { surface } : {}),
    };
  });

  // Read off the class, never restated: `Presenter(Post)` keeps `Post` in `__entity` and a
  // computed field IS a method, which `getPresenterFields` already reads from the prototype.
  // Asking for `entityName` and `fields` made a statement copy what the class carries — and
  // a copy that drifts silently, since nothing compares the two.
  const presenters: PresenterEntry[] = (declared.presenters ?? []).map((p) => {
    const ctor = ctorOf(p);
    const fields = getPresenterFields(ctor);

    return {
      entityName: lowerFirst(subjectOf(ctor, 'presenter').name),
      ctor,
      fields,
      fieldMeta: fields.map((field) => ({ name: field })),
      deps: depsOf(p),
      filePath: '',
    };
  });

  // `Collector(User)` keeps `User` the same way — the type a handler names to receive it.
  const collectors: CollectorEntry[] = (declared.collectors ?? []).map((c) => {
    const ctor = ctorOf(c);

    return {
      typeName: subjectOf(ctor, 'collector').name,
      ctor,
      deps: depsOf(c),
      filePath: '',
    };
  });

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
