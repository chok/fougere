import { Middleware, type AppNext, type OperationContext } from '@fougere/core';

/** Declared in `ops`, which serves nothing — so it runs around every frond under it. */
export default class Everywhere extends Middleware {
  async around<T>(context: OperationContext, next: AppNext<T>): Promise<T> {
    ((globalThis as Record<string, unknown>).__around as string[])
      .push(`everywhere:${context.address}.${context.operation}`);

    return next();
  }
}
