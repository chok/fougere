import { frond } from '../../src/index.js';
import { op } from '../contract.js';
import CheckoutHandler from './fronds/billing/handlers/CheckoutHandler.js';
import Mailer from './fronds/billing/services/Mailer.js';
import Payment from './fronds/billing/services/Payment.js';
import StripePayment from './fronds/billing/services/StripePayment.js';

export default [frond('billing', {
  providers: [Mailer, Payment, StripePayment],
  handlers: [{
    ctor: CheckoutHandler,
    deps: ['Payment'],
    operations: { pay: op({ cardinality: 'one', description: 'Charge the cart.' }) },
  }],
})];
