import type { Ctor } from './Ctor.js';
/** What a subject needs beyond its class, when its constructor names a frame or a port. */
export interface DeclaredSubject {
  ctor: Ctor;
  deps?: string[];
}
