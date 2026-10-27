import type { Call, Dispatcher } from '@fougere/core';

/**
 * What a link on a port cannot see: the refusal, as the caller receives it.
 *
 * `RetryingPayment` stands in front of `Payment` and sees a charge; this stands in front of the
 * DISPATCH and sees the call's answer — which is the line between the two. It holds what comes next,
 * so it may not run it and may act on what came back; a link on `Payment` answers a gesture and knows
 * nothing of the call that asked for it.
 */
export default class Attempted implements Partial<Dispatcher> {
  constructor(private inner: Dispatcher) {}

  async dispatch(call: Call): Promise<unknown> {
    const { address, operation } = call.address;
    try {
      const answer = await this.inner.dispatch(call);
      console.log(`    around  ${address}.${operation} → answered`);

      return answer;
    } catch (refusal) {
      console.log(`    around  ${address}.${operation} → refused: ${(refusal as Error).message}`);
      throw refusal;
    }
  }
}
