/** workerd with no flag: */
import type { SpanContext } from '../traceparent.js';
import type { TraceContext } from './port.js';

export const traceContext: TraceContext = {
  ambient: false,
  current: <T extends SpanContext>(): T | undefined => undefined,
  within: (_span, fn) => fn(),
};
