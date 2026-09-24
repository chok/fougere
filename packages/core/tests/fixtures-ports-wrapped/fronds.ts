import { frond } from '../../src/index.js';
import { op } from '../contract.js';
import CheckoutHandler from './fronds/billing/handlers/CheckoutHandler.js';
import Payment from './fronds/billing/services/Payment.js';
import RetryingPayment from './fronds/billing/services/RetryingPayment.js';
import StripePayment from './fronds/billing/services/StripePayment.js';
import TimingPayment from './fronds/billing/services/TimingPayment.js';

export default [frond('billing', {
  providers: [
    Payment,
    { ctor: RetryingPayment, deps: ['Payment'] },
    StripePayment,
    { ctor: TimingPayment, deps: ['Payment'] },
  ],
  handlers: [{
    ctor: CheckoutHandler,
    deps: ['Payment'],
    operations: { pay: op({ cardinality: 'one', description: 'Charge the cart.' }) },
  }],
})];
