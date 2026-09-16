import type { AppNext, OperationContext } from '@fougere/core';
import Trail from '../services/Trail.js';

/** Its own frond, because nothing says otherwise. */
export default class Audit {
  constructor(private trail: Trail) {
    const counts = (globalThis as Record<string, unknown>).__audit as { built: number } | undefined;
    if (counts) counts.built += 1;
  }

  async around(context: OperationContext, next: AppNext): Promise<unknown> {
    this.trail.note(`audit:${context.entity}.${context.operation}`);

    return next();
  }

  async [Symbol.asyncDispose](): Promise<void> {
    const counts = (globalThis as Record<string, unknown>).__audit as { closed: number } | undefined;
    if (counts) counts.closed += 1;
  }
}
