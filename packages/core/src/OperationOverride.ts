import type { EntityConstructor, SchemaView } from '@fougere/schema';
import type { BindingPlan } from './wire/binding.js';

/** Per-operation override. */
export interface OperationOverride {
  /** Force operation kind, over the naming convention (`isReadOp`). */
  kind?: 'query' | 'command';
  /** The GraphQL root field this op answers to. */
  graphql?: string;
  /**
   * Where this op answers over REST — the dual of `graphql:`, and the frond's to say for
   * the same reason: how an operation is CALLED belongs beside it, not in whatever host
   * mounts the router. The prefix stays the host's: naming is the frond's, mounting is not.
   */
  rest?: { method?: string; path?: string; status?: number };
  /**
   * Handler class to delegate to (overrides the default `{Entity}Handler` lookup).
   * Class name is used to resolve from DI. E.g. `ArchiveHandler` → `app.resolve('ArchiveHandler')`.
   */
  handler?: EntityConstructor;
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
