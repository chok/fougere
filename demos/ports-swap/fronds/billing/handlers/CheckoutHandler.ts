import Payment from '../services/Payment.js';

/**
 * The whole point of the demo is that this file does not change between the two runs
 * below, and never mentions a PSP.
 */
export default class CheckoutHandler {
  constructor(private payment: Payment) {}

  /** Charge the cart. */
  async pay(): Promise<{ provider: string; reference: string; amountCents: number }> {
    return this.payment.charge(4990);
  }
}
