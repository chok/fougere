import type { ErrorCode } from '../wire/ErrorCode.js';
import type { Subject } from './Subject.js';
/** A discovered collector (resolves handler input params from invocation context). */
export interface CollectorEntry extends Subject {
  /** Registration key of the TYPE this collector resolves — 'user', 'ability'. */
  typeName: string;
  /**
   * What its `missing()` refuses a required parameter it found nothing for with — read by the scan
   * off the method, or stated. It joins the `errors` of every op asking for it without `?`.
   */
  refuses?: ErrorCode[];
  /** What its `collect()` refuses — it runs for every op asking for it, so it joins all of their `errors`. */
  collecting?: ErrorCode[];
}
