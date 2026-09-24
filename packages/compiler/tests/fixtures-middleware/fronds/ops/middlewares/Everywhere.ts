import type { AppNext, OperationContext } from '@fougere/core';

/** Declared in `ops`, which serves nothing — so it runs around every frond under it. */
export default class Everywhere {
  async around(context: OperationContext, next: AppNext): Promise<unknown> {
    ((globalThis as Record<string, unknown>).__around as string[])
      .push(`everywhere:${context.entity}.${context.operation}`);

    return next();
  }
}
