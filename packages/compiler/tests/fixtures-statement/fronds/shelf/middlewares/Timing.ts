import { Middleware, type AppNext, type OperationContext } from '@fougere/core';

export default class Timing extends Middleware {
  async around<T>(_context: OperationContext, next: AppNext<T>): Promise<T> {
    return next();
  }
}
