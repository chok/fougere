import Payment, { type Charge } from './Payment.js';

export default class StripePayment extends Payment {
  charge(amountCents: number): Charge {
    return { provider: 'stripe', amountCents };
  }
}
