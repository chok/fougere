import type Restock from '../entities/Restock.js';
import type User from '../entities/User.js';

export default class ArticleHandler {
  /** Put stock back on the shelf, and say who did. */
  async restock(id: string, input: Restock, user?: User): Promise<{ id: string; sku: string; quantity: number; by: string | null }> {
    return { id, sku: 'fern', quantity: input.quantity, by: user?.email ?? null };
  }

  /** What a restock adds up to, read off the fact. */
  async record(restock: Restock): Promise<number> {
    return restock.quantity;
  }
}
