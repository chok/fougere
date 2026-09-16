import Payment from '../services/Payment.js';
import Ledger from '../services/Ledger.js';

/**
 * The whole point of the demo is that this file does not change between the two runs
 * below, and never mentions a PSP.
 */
export default class CheckoutHandler {
  constructor(private payment: Payment, private ledger: Ledger) {}

  /** Charge the cart. */
  async pay(): Promise<{ provider: string; reference: string; amountCents: number }> {
    const charge = this.payment.charge(4990);
    this.ledger.record(charge.reference);

    return charge;
  }
}
