import CardPayment from './CardPayment.js';

export default class StripePayment extends CardPayment {
  charge(amountCents: number): string {
    return `stripe:${amountCents}`;
  }
}
