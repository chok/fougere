import type { Storage } from '@fougere/core';
import type Item from '../entities/Item.js';

export default class ItemHandler {
  constructor(private items: Storage<Item>) {}

  /** Every item. */
  async all() { return this.items.list(); }
}
