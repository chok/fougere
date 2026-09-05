import { trace } from '../../../trace.js';
import Product from '../entities/Product.js';

/** Writes only what it was handed, plus a member no view declares. */
export default class ProductHandler {
  async create(input: Product): Promise<Product> {
    trace.push('handler');

    return { ...input, internal: true } as unknown as Product;
  }
}
