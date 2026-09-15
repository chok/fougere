import type { AppNext, OperationContext } from '@fougere/core';

/** Widened to the app by `frond.config.ts` — one frond deciding for the others. */
export default class Everywhere {
  async around(context: OperationContext, next: AppNext): Promise<unknown> {
    ((globalThis as Record<string, unknown>).__around as string[])
      .push(`everywhere:${context.entity}.${context.operation}`);

    return next();
  }
}
