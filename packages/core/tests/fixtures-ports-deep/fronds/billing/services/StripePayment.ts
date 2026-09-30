import CardPayment from './CardPayment.js';

export default class StripePayment extends CardPayment {
  readonly network = 'visa';

  charge(amountCents: number) {
    return { provider: 'stripe', amountCents };
  }
}
