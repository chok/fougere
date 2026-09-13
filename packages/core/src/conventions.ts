/** The names the scan READS instead of deriving them. */

export interface Conventions {
  /** The scope a frond's package name carries — `@fronds/blog`. */
  scope: string;
  /** The directory holding fronds, below the project root. */
  fronds: string;
  /** Directory per role. The role is the key; the name on disk is the value. */
  dirs: {
    entities: string;
    handlers: string;
    services: string;
    repositories: string;
    presenters: string;
    collectors: string;
    seeds: string;
    /**
     * What runs around this frond's operations. Scoped to the frond that declares it,
     * unless `frond.config.ts` widens it — the one directory whose members apply to code
     * they do not name.
     */
    middlewares: string;
    /**
     * What the domain computes with nothing injected. Read into the type program, because
     * a handler names one of its types in a signature, and registered nowhere: no class
     * here answers a container key.
     */
    rules: string;
    /** What its shapes used to be — written by `fougere freeze`, replayed by `migrate`. */
    versions: string;
    /**
     * The words this frond adds to the declaration — a generator, a format, a boundary codec.
     * Read BEFORE `entities`, alone among the directories: an entity may write
     * `generate: 'ulid'`, and a name a registry does not hold yet is a name it refuses.
     */
    vocabulary: string;
    /**
     * What rises and falls with the process, written beside the code it instruments.
     * Recognized by its FORM — a module stating `up` or `down` — and it travels with its
     * frond: moved behind `remotes:`, it mounts on the process that serves it there.
     */
    extensions: string;
  };
}

/** What a project means when it declares nothing — the convention itself. */
export const DEFAULT_CONVENTIONS: Conventions = {
  scope: '@fronds',
  fronds: 'fronds',
  dirs: {
    entities: 'entities',
    handlers: 'handlers',
    services: 'services',
    repositories: 'repositories',
    presenters: 'presenters',
    collectors: 'collectors',
    seeds: 'seeds',
    middlewares: 'middlewares',
    rules: 'rules',
    versions: 'versions',
    vocabulary: 'vocabulary',
    extensions: 'extensions',
  },
};

/** What a `fougere.config.ts` may state: only the names that differ. */
export type ConventionsInput = {
  scope?: string;
  fronds?: string;
  dirs?: Partial<Conventions['dirs']>;
};

/** The convention, with a project's exceptions folded in. */
export function resolveConventions(input?: ConventionsInput): Conventions {
  return {
    scope: input?.scope ?? DEFAULT_CONVENTIONS.scope,
    fronds: input?.fronds ?? DEFAULT_CONVENTIONS.fronds,
    dirs: { ...DEFAULT_CONVENTIONS.dirs, ...input?.dirs },
  };
}

/** The package name a frond answers to. */
export function frondPackage(name: string, conventions: Conventions): string {
  return `${conventions.scope}/${name}`;
}

/** Directories whose classes register as providers — two spellings, one behaviour. */
export function providerDirsOf(conventions: Conventions): string[] {
  return [...new Set([conventions.dirs.services, conventions.dirs.repositories])];
}

/** The frond vocabulary — every directory the scan reads. */
export function frondDirsOf(conventions: Conventions): string[] {
  const { entities, handlers, presenters, collectors, seeds, middlewares, rules, versions } = conventions.dirs;
  const { vocabulary, extensions } = conventions.dirs;

  // `vocabulary` first, and the order is the point: an entity may name what it registers.
  return [...new Set([
    vocabulary,
    entities, handlers, presenters, collectors, seeds, middlewares, rules, versions, extensions,
    ...providerDirsOf(conventions),
  ])];
}
