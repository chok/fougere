import type { RepositoryOf } from '@fougere/core';
import Item from '../entities/Item.js';

/** Two ways to answer the same question, and only their cost tells them apart. */
export default class ItemHandler {
  constructor(private items: RepositoryOf<Item>) {}

  async add(input: Item): Promise<Item> {
    return this.items.create(input);
  }

  /** The page, and nothing more. */
  async list(): Promise<Item[]> {
    return [...await this.items.list()];
  }

  /** The same rows, read one at a time — and nothing in the code says so out loud. */
  async listOneByOne(): Promise<Item[]> {
    const page = await this.items.list();

    return Promise.all(page.map(async (item) => (await this.items.findById(item.id))!));
  }
}
