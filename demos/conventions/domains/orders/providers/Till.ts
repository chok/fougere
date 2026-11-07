import { withTax } from '@shop/orders/logic/withTax.js';

export default class Till {
  total(cents: number): number {
    return withTax(cents);
  }
}
