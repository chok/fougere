import Pricing from './Pricing.js';

export default class VatPricing extends Pricing {
  total(cents: number): number {
    return Math.round(cents * 1.2);
  }
}
