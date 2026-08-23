/**
 * The default: a real `AsyncLocalStorage`, so a call with no wire above it still finds
 * its parent in the stack it is running inside.
 */
import { AsyncLocalStorage } from 'node:async_hooks';
import type { SpanContext } from '../traceparent.js';
import type { TraceContext } from './port.js';

const store = new AsyncLocalStorage<SpanContext>();

export const traceContext: TraceContext = {
  ambient: true,
  current: <T extends SpanContext>() => store.getStore() as T | undefined,
  within: (span, fn) => store.run(span, fn),
};
