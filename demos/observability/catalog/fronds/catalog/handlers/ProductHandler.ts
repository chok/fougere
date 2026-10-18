import { FougereError, ErrorCode, type Repository } from '@fougere/core';
import type Product from '../entities/Product.js';

/** The catalog's facade. Nothing here knows it is called from another process. */
export default class ProductHandler {
  constructor(private products: Repository<Product>) {}

  async list() {
    return this.products.list();
  }

  async findById(id: string) {
    return this.products.findById(id);
  }

  /** Deliberately refuses — a dashboard needs a real error rate, not a simulated one. */
  async reserve(): Promise<never> {
    throw new FougereError({
      code: ErrorCode.CONFLICT,
      message: 'stock already held',
    });
  }
}
