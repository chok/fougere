import type { AppNext, OperationContext } from '@fougere/core';

/**
 * What a link on a port cannot see: the refusal, as the caller receives it.
 *
 * `RetryingPayment` stands in front of `Payment` and sees a charge; this stands around the
 * OPERATION and sees its answer — which is the line between the two. A middleware holds what
 * comes next, so it may not run it and may act on what came back; a link on a port answers a
 * gesture and knows nothing of the call that asked for it.
 */
export default class Attempted {
  async around(context: OperationContext, next: AppNext): Promise<unknown> {
    try {
      const answer = await next();
      console.log(`    around  ${context.entity}.${context.operation} → answered`);

      return answer;
    } catch (refusal) {
      console.log(`    around  ${context.entity}.${context.operation} → refused: ${(refusal as Error).message}`);
      throw refusal;
    }
  }
}
