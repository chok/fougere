import type { Emit } from '@fougere/core';
import type ItemPriced from '../entities/ItemPriced.js';

/** Announces the fact, and names no recipient. */
export default class ItemHandler {
  constructor(private priced: Emit<ItemPriced>) {}

  /** Set an item price, and say so. */
  async set(id: string): Promise<{ id: string }> {
    await this.priced({ id, label: `item ${id}`, price: 100 });

    return { id };
  }
}
