import Payment, { type Charge } from './Payment.js';

export default class OgonePayment extends Payment {
  charge(amountCents: number): Charge {
    return { provider: 'ogone', amountCents };
  }
}
