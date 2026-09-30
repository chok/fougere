import { frond, type Declared } from '../../src/index.js';
import { op } from '../contract.js';
import CheckoutHandler from './fronds/billing/handlers/CheckoutHandler.js';
import CardPayment from './fronds/billing/services/CardPayment.js';
import Payment from './fronds/billing/services/Payment.js';
import RetryingCardPayment from './fronds/billing/services/RetryingCardPayment.js';
import StripePayment from './fronds/billing/services/StripePayment.js';

/** The billing frond over the providers a case declares — the chain is what varies. */
export const billing = (providers: Declared[]) => [frond('billing', {
  providers,
  handlers: [{
    ctor: CheckoutHandler,
    deps: ['Payment', 'CardPayment'],
    operations: { pay: op({ cardinality: 'one', description: 'Charge the cart through each port.' }) },
  }],
})];

export { CardPayment, Payment, RetryingCardPayment, StripePayment };
