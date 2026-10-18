import Payment from '../services/Payment.js';

export default class CheckoutHandler {
  constructor(private payment: Payment) {}

  async pay(cents: number): Promise<string> { return this.payment.charge(cents); }
}
