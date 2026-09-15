import type { AppNext, OperationContext } from '@fougere/core';
import Money from '../services/Money.js';

/**
 * It names no frond and no entity, and it runs around every operation of the family.
 *
 * `Money` comes from `billing`'s own scope: an inherited middleware takes its dependencies
 * where it was declared, which is inheriting the code and not the context.
 */
export default class Audit {
  constructor(private money: Money) {}

  async around(context: OperationContext, next: AppNext): Promise<unknown> {
    const answer = await next();
    console.log(`  audit  ${context.entity}.${context.operation} → ${this.money.format(1250)}`);

    return answer;
  }
}
