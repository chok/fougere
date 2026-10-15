import type { AppNext, OperationContext } from '@fougere/core';

/** States `around` and extends nothing — a forgotten `extends`, which reads exactly like a helper. */
export default class Unextended {
  async around<T>(_context: OperationContext, next: AppNext<T>): Promise<T> {
    return next();
  }
}
