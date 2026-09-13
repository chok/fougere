import type { Pipe } from '@fougere/core';
import type ItemPriced from '../entities/ItemPriced.js';

/** A second link, and nothing says which runs first. */
export default class TaxHandler {
  /** Charge tax on the price. */
  async charge(fact: Pipe<ItemPriced>): Promise<ItemPriced> {
    return { ...fact, price: Math.round(fact.price * 1.2) } as ItemPriced;
  }
}
