import type { SchemaView } from '@fougere/schema';
import type { Ctor } from './Ctor.js';
import type { BindingPlan } from './wire/binding.js';
import type { OperationKind } from './wire/OperationKind.js';
import type { FougereOperationProtocols } from './FougereOperationProtocols.js';

/** Per-operation override. */
export interface OperationOverride extends FougereOperationProtocols {
  /** Force operation kind, over the naming convention (`isReadOp`). */
  kind?: OperationKind;
  /**
   * Handler class to delegate to (overrides the default `{Entity}Handler` lookup).
   * Class name is used to resolve from DI. E.g. `ArchiveHandler` → `app.resolve('ArchiveHandler')`.
   */
  handler?: Ctor;
  /** Method name on `handler` (defaults to the operation name). */
  method?: string;
  /** CASL ability check (e.g. */
  policy?: string;

  // ── The contract itself — see the note above ──

  /** What validates the input. The view carries its own mode (`partial()` → patch). */
  input?: SchemaView;
  /**
   * Where each argument is read from — states what the scan would otherwise derive
   * from the method signature. An empty array is meaningful: "this op takes nothing".
   */
  binding?: BindingPlan;

  /** Per-operation output view, below prefab declarations and above handler/entity defaults. */
  output?: SchemaView;
}
