/**
 * The port. Nothing declares it as one — `class VatPricing extends Pricing` does.
 * In a test it is the one thing worth standing in for: a rate is a fact about the
 * outside world, not about the catalog.
 */
export default class Pricing {
  total(cents: number): number {
    return cents;
  }
}
