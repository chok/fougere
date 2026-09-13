import type { Facade } from '@fougere/core';
import type PriceHandler from '../../pricing/handlers/PriceHandler.js';
import type ProductHandler from '../../catalog/handlers/ProductHandler.js';

/**
 * Two neighbours by TYPE, and not a word about where either runs.
 *
 * `fougere.config.ts` is the whole topology statement. Uncomment a line there and this file
 * reports two network hops instead of none — without changing by a comma.
 */
export default class CartHandler {
  constructor(
    private priceFacade: Facade<PriceHandler>,
    private productFacade: Facade<ProductHandler>,
  ) {}

  /** What is on the shelf, and what it costs. */
  async checkout(): Promise<{ items: number; cents: number }> {
    const products = await this.productFacade.list() as unknown[];
    const cents = await this.priceFacade.total() as number;

    return { items: products.length, cents };
  }
}
