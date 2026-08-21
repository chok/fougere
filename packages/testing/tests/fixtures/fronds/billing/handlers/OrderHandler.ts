import Payment from '../services/Payment.js';

export default class OrderHandler {
  constructor(private payment: Payment) {}

  /** Charges the order through whatever answers under Payment. */
  async pay(): Promise<{ provider: string; cents: number }> {
    return this.payment.charge(4990);
  }
}
