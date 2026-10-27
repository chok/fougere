import type Payment from './Payment.js';

/** Stands in front of a Payment without being one: it writes `charge`, and `refund` is the inner's. */
export default class AuditPayment implements Partial<Payment> {
  constructor(private inner: Payment) {}

  charge(amountCents: number): string {
    return `audited(${this.inner.charge(amountCents)})`;
  }
}
