import { Middleware, type AppNext, type OperationContext } from '@fougere/core';

/** Extends `Middleware` and misspells `around` — what runs when nothing type-checked it. */
export default class Misspelled extends Middleware {
  async arond<T>(_context: OperationContext, next: AppNext<T>): Promise<T> {
    return next();
  }
}
