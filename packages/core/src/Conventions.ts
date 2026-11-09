import type { ConventionsInput } from './ConventionsInput.js';

export interface Conventions {
  /** The scope a frond's package name carries — `@fronds/blog`. */
  scope: string;
  /** The directory holding fronds, below the project root. */
  fronds: string;
  /** Directory per role. The role is the key; the name on disk is the value. */
  dirs: {
    entities: string;
    handlers: string;
    /** Every class the frond injects, told apart by what it extends. */
    services: string;
    seeds: string;
    /** What the domain computes with nothing injected; registered nowhere. */
    rules: string;
    /** What its shapes used to be — written by `fougere freeze`, replayed by `migrate`. */
    versions: string;
    /**
     * The words this frond adds to the declaration; read before `entities`.
     * Ex: a generator, a format, a boundary codec.
     */
    vocabulary: string;
    /** What rises and falls with the process, recognized by stating `up` or `down`. */
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
    seeds: 'seeds',
    rules: 'rules',
    versions: 'versions',
    vocabulary: 'vocabulary',
    extensions: 'extensions',
  },
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

/** Where a frond's directory of one kind sits, as the project spells it — `fronds/shop/services/`. */
export function directoryOf(frond: string, dir: keyof Conventions['dirs'], conventions: Conventions): string {
  return `${conventions.fronds}/${frond}/${conventions.dirs[dir]}/`;
}

/** The frond vocabulary — every directory the scan reads. */
export function frondDirsOf(conventions: Conventions): string[] {
  const { vocabulary, entities, handlers, services, seeds, rules, versions, extensions } = conventions.dirs;

  return [...new Set([vocabulary, entities, handlers, services, seeds, rules, versions, extensions])];
}
