import { Middleware, type AppNext, type OperationContext } from '@fougere/core';
import Money from '../services/Money.js';

/**
 * It names no frond and no entity, and it runs around every operation of the family.
 *
 * `Money` comes from `billing`'s own scope: an inherited middleware takes its dependencies
 * where it was declared, which is inheriting the code and not the context.
 */
export default class Audit extends Middleware {
  constructor(private money: Money) {
    super();
  }

  async around<T>(context: OperationContext, next: AppNext<T>): Promise<T> {
    const answer = await next();
    console.log(`  audit  ${context.address}.${context.operation} → ${this.money.format(1250)}`);

    return answer;
  }
}
