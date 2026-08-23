/**
 * workerd with no flag: there is no ambient store, so there is no parent to find.
 *
 * NOT a module-level variable standing in for one. An isolate serves many requests at
 * once and a shared slot would attribute one call's span to another — a trace that is
 * wrong is worse than a trace that is absent, which is the same answer the emission
 * chain gives one file over.
 *
 * What is lost is exactly this: a call that crossed NO wire starts its own trace. An
 * arriving call is untouched — it reads `traceparent` off the invocation — and so is a
 * call to a frond behind `remotes:`, which crosses one. `nodejs_als` in
 * `compatibility_flags` restores the rest, and the boot names it.
 */
import type { SpanContext } from '../traceparent.js';
import type { TraceContext } from './port.js';

export const traceContext: TraceContext = {
  ambient: false,
  current: <T extends SpanContext>(): T | undefined => undefined,
  within: (_span, fn) => fn(),
};
