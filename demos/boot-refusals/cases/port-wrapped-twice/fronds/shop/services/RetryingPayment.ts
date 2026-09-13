import Payment from './Payment.js';

/** Extends the port AND asks for it — the form of a wrapper. */
export default class RetryingPayment extends Payment {
  constructor(private inner: Payment) { super(); }

  async charge(cents: number) { return this.inner.charge(cents); }
}
