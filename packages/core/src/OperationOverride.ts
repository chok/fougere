import type { SchemaView } from '@fougere/schema';
import type { Ctor } from './Ctor.js';
import type { BindingPlan } from './wire/binding.js';
import type { OperationKind } from './wire/OperationKind.js';
import type { FougereOperationProtocols } from './FougereOperationProtocols.js';

/** Per-operation override. */
export interface OperationOverride extends FougereOperationProtocols {
  /** Force operation kind, over the naming convention (`isReadOp`). */
  kind?: OperationKind;
  /** The handler class to delegate to, resolved by its name. */
  handler?: Ctor;
  /** Method name on `handler` (defaults to the operation name). */
  method?: string;
  /** CASL ability check (e.g. */
  policy?: string;


  /** What validates the input. The view carries its own mode (`partial()` → patch). */
  input?: SchemaView;
  /** Where each argument is read from; an empty array means the op takes nothing. */
  binding?: BindingPlan;

  /** Per-operation output view, below prefab declarations and above handler/entity defaults. */
  output?: SchemaView;
}
