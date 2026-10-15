import type { AppNext } from '../wire/AppNext.js';
import type { OperationContext } from '../wire/OperationContext.js';

/**
 * What runs around every operation of its frond, and of the fronds under it — a class in
 * `middlewares/` that extends this one.
 *
 * It answers what `next()` answered, the same type: a caller reads the handler's signature,
 * and nothing tells that signature a middleware stood in the way.
 */
export abstract class Middleware {
  abstract around<T>(context: OperationContext, next: AppNext<T>): Promise<T>;
}
