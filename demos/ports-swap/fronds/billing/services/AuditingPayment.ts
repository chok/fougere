import Payment, { type Charge } from './Payment.js';

/**
 * A link, not a realization — it extends the port AND asks for it, which is the whole
 * declaration. Nothing registers it, and `CheckoutHandler` still asks for `Payment`.
 *
 * `super.charge()` would reach the abstract base, which has no body: `AuditingPayment` and
 * `StripePayment` are siblings, not parent and child. The inheritance says only which key
 * this class answers under; the work goes through `inner`, which is what the config named.
 */
export default class AuditingPayment extends Payment {
  constructor(private inner: Payment) {
    super();
  }

  charge(amountCents: number): Charge {
    const said = this.inner.charge(amountCents);

    return { ...said, provider: `audited(${said.provider})` };
  }
}
