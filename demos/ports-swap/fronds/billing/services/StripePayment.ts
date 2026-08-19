import Payment, { type Charge } from './Payment.js';

let seq = 0;

export default class StripePayment extends Payment {
  charge(amountCents: number): Charge {
    return { provider: 'stripe', reference: `ch_${++seq}`, amountCents };
  }
}
