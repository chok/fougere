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
    /** What its shapes used to be — written by `fougere freeze`, replayed by `migrate`. */
    versions: string;
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
    versions: 'versions',
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
  const { entities, handlers, presenters, collectors, seeds, versions } = conventions.dirs;
  return [...new Set([
    entities, handlers, presenters, collectors, seeds, versions, ...providerDirsOf(conventions),
  ])];
}
