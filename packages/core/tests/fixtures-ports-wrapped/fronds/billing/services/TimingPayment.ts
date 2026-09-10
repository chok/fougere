import Payment, { type Charge } from './Payment.js';

/** A second wrapper — so the chain has an order, and the order has to be said. */
export default class TimingPayment extends Payment {
  constructor(private inner: Payment) {
    super();
  }

  charge(amountCents: number): Charge {
    const said = this.inner.charge(amountCents);

    return { ...said, provider: `timing(${said.provider})` };
  }
}
