import Money from '@fronds/billing/services/Money.js';

/** The second reader of the same service, and it says no more about it than the first. */
export default class InvoiceHandler {
  constructor(private money: Money) {}

  /** What the customer owes. */
  async quote(): Promise<string> {
    return this.money.format(9900);
  }
}
