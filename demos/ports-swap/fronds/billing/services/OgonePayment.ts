import Payment, { type Charge } from './Payment.js';

let seq = 0;

export default class OgonePayment extends Payment {
  charge(amountCents: number): Charge {
    return { provider: 'ogone', reference: `ACME-${++seq}`, amountCents };
  }
}
