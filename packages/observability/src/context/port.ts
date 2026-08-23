/**
 * Where the step running right now is kept — the one thing a Worker cannot do.
 *
 * A trace has TWO ways to name its parent, and only one of them is ambient: an arriving
 * call carries `traceparent` on the invocation, which every transport moves and which
 * needs nothing from the runtime. This is the other way — the parent of a call that
 * crossed no wire, which is in the stack and nowhere else.
 *
 * `node:async_hooks` does not exist on workerd unless the deployment asks for it, so
 * `#trace-context` resolves to two realizations: the real store by default, and one that
 * answers "no parent here" under the `workerd` condition. What that costs is stated at
 * boot rather than discovered in a trace viewer — see `traceContext.ambient`.
 */
import type { SpanContext } from '../traceparent.js';

export interface TraceContext {
  /**
   * Whether a parent can be found without a wire. False means every in-process call
   * starts its own trace, and the boot says so.
   */
  readonly ambient: boolean;
  /** The step running here and now, when one can be known. */
  current<T extends SpanContext>(): T | undefined;
  /** Run `fn` with `span` as the step in scope. */
  within<T extends SpanContext, R>(span: T, fn: () => Promise<R>): Promise<R>;
}
