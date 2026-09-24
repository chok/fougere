import type { AbstractCtor } from './Ctor.js';
import type { DeclaredSubject } from './DeclaredSubject.js';

/** A class on its own — a port, which is abstract, included — or a class with what it asks for. */
export type Declared = AbstractCtor | (Omit<DeclaredSubject, 'ctor'> & {
  ctor: AbstractCtor;
  /** The container key, when the class's own name cannot be trusted to survive a build. */
  name?: string;
});
