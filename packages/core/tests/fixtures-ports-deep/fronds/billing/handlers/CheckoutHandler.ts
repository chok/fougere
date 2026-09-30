import Payment from '../services/Payment.js';
import CardPayment from '../services/CardPayment.js';

export default class CheckoutHandler {
  constructor(private payment: Payment, private card: CardPayment) {}

  /** Charge the cart through each port. */
  async pay(): Promise<{ payment: string; card: string }> {
    return { payment: this.payment.charge(4990).provider, card: this.card.charge(4990).provider };
  }
}
