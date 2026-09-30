import type { AnyHandler, FacadeName } from '@fougere/core/contract';

export interface FormOptions {
  /** Command the submit rides. Default: 'create'. */
  op?: string;
  /** The facade the submit goes to. Default: the one named like the entity — `post` for `Post`. */
  to?: FacadeName<AnyHandler, string>;
  /** Initial values (edit mode: the loaded entity). */
  initial?: Record<string, unknown>;
  /** Call params designating the target (edit mode: { id }). */
  params?: Record<string, string>;
}
