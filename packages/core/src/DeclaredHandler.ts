import type { OperationContract } from './wire/OperationContract.js';
import type { DeclaredSubject } from './DeclaredSubject.js';

/** A handler, and the surface it answers on when it is not the default one. */
export interface DeclaredHandler extends DeclaredSubject {
  /**
   * The scan reads this from the directory (`handlers/public/`), so a statement has to say it: two
   * handlers over one entity collide on their address otherwise, and the refusal names the same
   * route twice.
   */
  surface?: string;
  /**
   * What each method takes and answers — read from SOURCE by the scan, and unreachable
   * from a class at runtime. A prefab declares its own (`Crud.__ops`) and needs nothing
   * here; a method someone wrote does, or the route it should serve does not exist.
   */
  operations?: ReadonlyMap<string, OperationContract> | Record<string, OperationContract>;
}
