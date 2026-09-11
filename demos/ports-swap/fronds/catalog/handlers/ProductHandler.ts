import type { RepositoryOf } from '@fougere/core';
import type Product from '../entities/Product.js';

/** It names no seam and no neighbour — the whole point of the fifth run. */
export default class ProductHandler {
  constructor(private products: RepositoryOf<Product>) {}

  /** Put one product on the shelf. */
  async add(title: string): Promise<unknown> {
    return this.products.create({ id: title, title });
  }
}
