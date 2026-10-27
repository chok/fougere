import type Payment from '../services/Payment.js';

export default class CheckoutHandler {
  constructor(private payment: Payment) {}

  async pay(): Promise<string> {
    return this.payment.charge(4990);
  }

  async refund(): Promise<string> {
    return this.payment.refund(4990);
  }
}
