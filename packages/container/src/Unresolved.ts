import type { Constructor } from './registration/Constructor.js';

/** A registration whose constructor asks for a name nothing answers — `PostHandler` asking for `Mailer`. */
export interface Unresolved {
  name: string;
  ctor: Constructor;
  missing: string;
}
