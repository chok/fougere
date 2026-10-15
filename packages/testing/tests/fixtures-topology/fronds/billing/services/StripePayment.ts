import Payment from './Payment.js';

export default class StripePayment extends Payment {
  charge(cents: number): { provider: string; cents: number } {
    return { provider: 'stripe', cents };
  }
}
