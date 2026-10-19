import { ambient } from '@fougere/core';
import type { SpanContext } from './traceparent.js';

/** The step running now — this package's slot in core's context, beside the operation and the request. */
const span = ambient.slot<SpanContext>('span');

export const traceContext = {
  /** Whether a parent can be found without a wire; false means every in-process call starts its own trace. */
  ambient: !ambient.degraded,
  current: <T extends SpanContext>(): T | undefined => span.current() as T | undefined,
  within: <T extends SpanContext, R>(step: T, fn: () => Promise<R>): Promise<R> => span.within(step, fn),
};
