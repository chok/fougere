import type Payment from './Payment.js';

/** Implements part of the port and asks for none of it: it stands in front of nothing. */
export default class LonePayment implements Partial<Payment> {}
