import type Payment from './Payment.js';

/** Implements the port and asks for it: a link, which writes only what it changes. */
export default class AuditPayment implements Partial<Payment> {
  constructor(private inner: Payment) {}
}
