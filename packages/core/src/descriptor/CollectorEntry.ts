import type { ErrorCode } from '../wire/ErrorCode.js';
import type { Subject } from './Subject.js';
/** A discovered collector (resolves handler input params from invocation context). */
export interface CollectorEntry extends Subject {
  /** Registration key of the TYPE this collector resolves — 'user', 'ability'. */
  typeName: string;
  /** What its `missing()` refuses; it joins the `errors` of every op that requires the collector. */
  refuses?: ErrorCode[];
  /** What its `collect()` refuses — it runs for every op asking for it, so it joins all of their `errors`. */
  collecting?: ErrorCode[];
}
