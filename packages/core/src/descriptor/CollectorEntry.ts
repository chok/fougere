import type { Subject } from './Subject.js';
/** A discovered collector (resolves handler input params from invocation context). */
export interface CollectorEntry extends Subject {
  /** Registration key of the TYPE this collector resolves — 'user', 'ability'. */
  typeName: string;
}
