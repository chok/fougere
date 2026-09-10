import Payment from '../services/Payment.js';

export default class CheckoutHandler {
  constructor(private payment: Payment) {}

  /** Charge the cart. */
  async pay(): Promise<{ provider: string; amountCents: number }> {
    return this.payment.charge(4990);
  }
}
