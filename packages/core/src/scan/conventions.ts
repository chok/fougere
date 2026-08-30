/**
 * The names the scan READS instead of deriving them.
 *
 * Everything else a frond states, it states by its shape; these seven directories and the
 * import prefix are the one place where a name is the declaration. They were spelled as
 * literals in five packages, so a project could not move any of them and `frondsDir` was
 * a declared key with no reader.
 */

export interface Conventions {
  /**
   * The scope a frond's package name carries — `@fronds/blog`.
   *
   * A real package name, not only an alias: the CLI writes it as `name` in a scaffolded
   * frond and as a `workspace:*` dependency in the app that consumes it.
   */
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
    /** What its shapes used to be — written by `fougere freeze`, replayed by `migrate`. */
    versions: string;
  };
}

/**
 * What a project means when it declares nothing — the convention itself.
 *
 * `@fronds` and not `@frond`: the npm org for the singular belongs to someone else, and a
 * scope is a name that must be ownable.
 */
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
    versions: 'versions',
  },
};

/** What a `fougere.config.ts` may state: only the names that differ. */
export type ConventionsInput = {
  scope?: string;
  fronds?: string;
  dirs?: Partial<Conventions['dirs']>;
};

/**
 * The convention, with a project's exceptions folded in.
 *
 * Merged one level into `dirs` so renaming one directory does not require restating the
 * other six — the same reading `sources:` and `ports:` get, where only the exception is
 * declared.
 */
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

/**
 * Directories whose classes register as providers — two spellings, one behaviour.
 *
 * A project may point both roles at one directory; the scan must then read it once, or
 * every provider would be registered twice.
 */
export function providerDirsOf(conventions: Conventions): string[] {
  return [...new Set([conventions.dirs.services, conventions.dirs.repositories])];
}

/**
 * The frond vocabulary — every directory the scan reads.
 *
 * What a reader needs to bound a frond: the Nuxt module watches these for the root frond
 * (watching the root itself would match every write), and a flat app's tsconfig lists
 * them instead of `["."]`, which would swallow `app/` and `nuxt.config.ts`.
 */
export function frondDirsOf(conventions: Conventions): string[] {
  const { entities, handlers, presenters, collectors, seeds, versions } = conventions.dirs;
  return [...new Set([
    entities, handlers, presenters, collectors, seeds, versions, ...providerDirsOf(conventions),
  ])];
}
