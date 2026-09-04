/** Where the step running right now is kept — the one thing a Worker cannot do. */
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
