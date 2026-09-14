import type { Facade } from '@fougere/core';
import type ProductHandler from '@fronds/catalog/handlers/ProductHandler.js';

/**
 * Two crossings, and not a word about what carries them.
 *
 * Every run below drives THIS file unchanged — direct, journalled, replayed after a failure. What
 * differs is a list in `fougere.config.ts`.
 */
export default class CartHandler {
  constructor(private productFacade: Facade<ProductHandler>) {}

  /** What is on the shelf, and what it costs to take it. */
  async checkout(): Promise<{ items: number; cents: number }> {
    const products = await this.productFacade.list() as { id: string }[];
    const cents = await this.productFacade.charge() as number;

    return { items: products.length, cents };
  }
}
