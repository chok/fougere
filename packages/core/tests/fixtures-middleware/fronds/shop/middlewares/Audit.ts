import { Middleware, type AppNext, type OperationContext } from '@fougere/core';
import Trail from '../services/Trail.js';

/** Its own frond, because nothing says otherwise. */
export default class Audit extends Middleware {
  constructor(private trail: Trail) {
    super();
    const counts = (globalThis as Record<string, unknown>).__audit as { built: number } | undefined;
    if (counts) counts.built += 1;
  }

  async around<T>(context: OperationContext, next: AppNext<T>): Promise<T> {
    this.trail.note(`audit:${context.address}.${context.operation}`);

    return next();
  }

  async [Symbol.asyncDispose](): Promise<void> {
    const counts = (globalThis as Record<string, unknown>).__audit as { closed: number } | undefined;
    if (counts) counts.closed += 1;
  }
}
