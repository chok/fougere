import { FougereError, ErrorCode, type EntityOrm } from '@fougere/core';
import type Product from '../entities/Product.js';

/** The catalog's door. Nothing here knows it is called from another process. */
export default class ProductHandler {
  constructor(private productOrm: EntityOrm<Product>) {}

  async list() {
    return this.productOrm.list();
  }

  async findById(id: string) {
    return this.productOrm.findById(id);
  }

  /** Deliberately refuses — a dashboard needs a real error rate, not a simulated one. */
  async reserve(): Promise<never> {
    throw new FougereError({
      code: ErrorCode.CONFLICT,
      message: 'stock already held',
      entity: 'product',
      operation: 'reserve',
    });
  }
}
