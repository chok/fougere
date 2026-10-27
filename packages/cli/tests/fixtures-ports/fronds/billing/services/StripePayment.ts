import Payment from './Payment.js';

export default class StripePayment extends Payment {
  async charge(cents: number): Promise<string> { return `stripe:${cents}`; }
}
