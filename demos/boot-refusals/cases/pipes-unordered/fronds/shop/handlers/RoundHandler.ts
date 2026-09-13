import type { Pipe } from '@fougere/core';
import type ItemPriced from '../entities/ItemPriced.js';

/** A link: it finishes the fact. */
export default class RoundHandler {
  /** Apply rounding to the nearest ten. */
  async apply(fact: Pipe<ItemPriced>): Promise<ItemPriced> {
    return { ...fact, price: Math.round(fact.price / 10) * 10 } as ItemPriced;
  }
}
