import Payment from './Payment.js';

/** Implements where it meant to extend: the boot binds no port and says nothing. */
export default class StripePayment implements Payment {
  charge(cents: number): string { return `stripe:${cents}`; }
}
