import Payment from './Payment.js';

export default class LoggingPayment extends Payment {
  constructor(private inner: Payment) { super(); }

  async charge(cents: number) { return this.inner.charge(cents); }
}
