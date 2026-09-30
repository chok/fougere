import Payment from './Payment.js';

/** A port under a port: what extends it is a card payment, and a payment. */
export default abstract class CardPayment extends Payment {
  abstract readonly network: string;
}
