import type { Facade } from '@fougere/core';
import type ProductHandler from '@fronds/catalog/handlers/ProductHandler.js';

/**
 * The middle of the chain. It reaches the catalog and nothing else — and the only reason this
 * file exists is that a chain of three is what two columns of boxes cannot draw.
 */
export default class PriceHandler {
  constructor(private productFacade: Facade<ProductHandler>) {}

  /** What the shelf is worth, in cents. */
  async total(): Promise<number> {
    const products = await this.productFacade.list() as { cents: number }[];

    return products.reduce((sum, product) => sum + product.cents, 0);
  }
}
