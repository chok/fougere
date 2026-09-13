import Payment from './Payment.js';

export default class OgonePayment extends Payment {
  async charge(cents: number) { return `ogone:${cents}`; }
}
