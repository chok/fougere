import Payment, { type Charge } from './Payment.js';

/**
 * A WRAPPER, and its form is the whole declaration: it extends the port and asks for it.
 *
 * Nothing registers it and nothing names it — the same way nothing declares a realization.
 * What it stands in front of is decided at the binding, so this file names no provider.
 */
export default class RetryingPayment extends Payment {
  constructor(private inner: Payment) {
    super();
  }

  charge(amountCents: number): Charge {
    const said = this.inner.charge(amountCents);

    return { ...said, provider: `retrying(${said.provider})` };
  }
}
