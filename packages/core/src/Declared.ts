import type { Ctor } from './Ctor.js';
import type { DeclaredSubject } from './DeclaredSubject.js';

/** A class on its own, or a class with what it asks for. */
export type Declared = Ctor | (DeclaredSubject & {
  /** The container key, when the class's own name cannot be trusted to survive a build. */
  name?: string;
});
