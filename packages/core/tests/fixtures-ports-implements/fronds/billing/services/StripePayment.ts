import Payment from './Payment.js';

export default class StripePayment extends Payment {
  charge(amountCents: number): string {
    return `stripe charged ${amountCents}`;
  }

  refund(amountCents: number): string {
    return `stripe refunded ${amountCents}`;
  }
}
