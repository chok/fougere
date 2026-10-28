import type { Entity } from '@fougere/schema';
import type { AbstractCtor } from './Ctor.js';
import type { DeclaredSubject } from './DeclaredSubject.js';
import type { ProviderEntry } from './descriptor/ProviderEntry.js';

/** A class on its own — a port, which is abstract, included — or a class with what it asks for. */
export type Declared = AbstractCtor
  | (Omit<DeclaredSubject, 'ctor'> & { ctor: AbstractCtor } & Partial<Pick<ProviderEntry, 'name' | 'abstract' | 'implements' | 'answers' | 'refuses' | 'collecting'>> & Seating);

/**
 * What a class built on `Repository<…>` is built on — `repository: Post`, or the members of an
 * aggregate in order. TypeScript erases the type arguments, so a statement says them.
 */
export interface Seating {
  repository?: Entity | readonly Entity[];
  /** What a `Collect<User>` collects — an entity, or a class a call builds (`Collect<Ability>`). */
  collects?: abstract new (...args: never[]) => unknown;
  /** What a `Present<Post>` presents. */
  presents?: Entity;
}
