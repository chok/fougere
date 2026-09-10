import type { AppNext, OperationContext } from '@fougere/core';
import Trail from '../services/Trail.js';

/** Its own frond, because nothing says otherwise. */
export default class Audit {
  constructor(private trail: Trail) {}

  async around(context: OperationContext, next: AppNext): Promise<unknown> {
    this.trail.note(`audit:${context.entity}.${context.operation}`);

    return next();
  }
}
