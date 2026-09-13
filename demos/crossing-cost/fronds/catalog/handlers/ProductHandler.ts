import type Product from '../entities/Product.js';

declare class ProductRepository {
  list(): Promise<Product[]>;
}

/** The far end of the chain: it reaches nobody, so its reach is empty and that is a fact. */
export default class ProductHandler {
  constructor(private products: ProductRepository) {}

  /** Everything on the shelf. */
  async list(): Promise<Product[]> {
    return this.products.list();
  }
}
