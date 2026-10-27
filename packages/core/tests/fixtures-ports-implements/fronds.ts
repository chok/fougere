import { frond } from '../../src/index.js';
import { op } from '../contract.js';
import CheckoutHandler from './fronds/billing/handlers/CheckoutHandler.js';
import Payment from './fronds/billing/services/Payment.js';
import StripePayment from './fronds/billing/services/StripePayment.js';
import AuditPayment from './fronds/billing/services/AuditPayment.js';
import CapPayment from './fronds/billing/services/CapPayment.js';

const handlers = [{
  ctor: CheckoutHandler,
  deps: ['Payment'],
  operations: { pay: op({ cardinality: 'one' }), refund: op({ cardinality: 'one' }) },
}];

/** One link, declared by what the source says and the runtime erased: `implements`. */
export const one = [frond('billing', {
  providers: [{ ctor: Payment, abstract: true }, StripePayment, { ctor: AuditPayment, deps: ['Payment'], implements: ['Payment'] }],
  handlers,
})];

/** Two links, which only an order can stand one in front of the other. */
export const two = [frond('billing', {
  providers: [
    { ctor: Payment, abstract: true },
    StripePayment,
    { ctor: AuditPayment, deps: ['Payment'], implements: ['Payment'] },
    { ctor: CapPayment, deps: ['Payment'], implements: ['Payment'] },
  ],
  handlers,
})];

/** The same class with the clause left out: it asks for a Payment, and stands in front of nothing. */
export const undeclared = [frond('billing', {
  providers: [{ ctor: Payment, abstract: true }, StripePayment, { ctor: AuditPayment, deps: ['Payment'] }],
  handlers,
})];
