import type { OperationContract } from './wire/OperationContract.js';
import type { DeclaredSubject } from './DeclaredSubject.js';
import type { HandlerEntry } from './descriptor/HandlerEntry.js';
import type { StatementOperation } from './StatementOperation.js';
import type { Seating } from './Declared.js';

/** A handler, and the surface it answers on when it is not the default one. */
export type DeclaredHandler = DeclaredSubject & Partial<Pick<HandlerEntry, 'surface'>> & Seating & {
  /** What each method takes and answers, as the scan writes it or as a `StatementOperation`. */
  operations?: ReadonlyMap<string, OperationContract> | Record<string, OperationContract | StatementOperation>;
};
