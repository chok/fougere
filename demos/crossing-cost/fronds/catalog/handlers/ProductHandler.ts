import type { Repository } from '@fougere/core';
import type Product from '../entities/Product.js';

/** The far end of the chain: it reaches nobody, so its reach is empty and that is a fact. */
export default class ProductHandler {
  constructor(private products: Repository<Product>) {}

  /** Everything on the shelf. */
  async list(): Promise<Product[]> {
    return this.products.list();
  }
}
