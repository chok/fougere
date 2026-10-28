import type { Repository } from '@fougere/core';
import type Product from '../entities/Product.js';

/** The far side of the crossing. It knows nothing of who reaches it, or how. */
export default class ProductHandler {
  constructor(private products: Repository<Product>) {}

  /** Everything on the shelf. */
  async list(): Promise<Product[]> {
    return this.products.list();
  }

  /** What the shelf costs, all of it. */
  async charge(): Promise<number> {
    const shelf = await this.products.list();

    return shelf.reduce((total, product) => total + product.cents, 0);
  }
}
