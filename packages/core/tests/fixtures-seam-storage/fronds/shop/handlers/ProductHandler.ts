import type ProductRepository from '../repositories/ProductRepository.js';

export default class ProductHandler {
  constructor(private products: ProductRepository) {}

  /** Write one row. */
  async add(title: string): Promise<unknown> {
    return this.products.create({ id: title, title });
  }

  /** Read them back — a gesture the wrapper says nothing about. */
  async list(): Promise<unknown> {
    return this.products.list();
  }
}
