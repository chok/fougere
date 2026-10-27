import type Payment from './Payment.js';

export default class CapPayment implements Partial<Payment> {
  constructor(private inner: Payment) {}

  charge(amountCents: number): string {
    return `capped(${this.inner.charge(Math.min(amountCents, 1000))})`;
  }
}
