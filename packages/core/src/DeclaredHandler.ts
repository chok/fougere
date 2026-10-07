import type { OperationContract } from './wire/OperationContract.js';
import type { DeclaredSubject } from './DeclaredSubject.js';
import type { HandlerEntry } from './descriptor/HandlerEntry.js';

/** A handler, and the surface it answers on when it is not the default one. */
export type DeclaredHandler = DeclaredSubject & Partial<Pick<HandlerEntry, 'surface'>> & {
  /**
   * What each method takes and answers — read from SOURCE by the scan, and unreachable
   * from a class at runtime. A prefab declares its own (`Crud.__ops`) and needs nothing
   * here; a method someone wrote does, or the route it should serve does not exist.
   */
  operations?: ReadonlyMap<string, OperationContract> | Record<string, OperationContract>;
};
