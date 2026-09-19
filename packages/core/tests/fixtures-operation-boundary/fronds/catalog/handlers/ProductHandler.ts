import { trace } from '../../../trace.js';
import Product from '../entities/Product.js';

/** Writes what it was handed, a cost the client never sees, and a member no view declares. */
export default class ProductHandler {
  async create(input: Product): Promise<Product> {
    trace.push('handler');

    return { ...input, cost: 150, internal: true } as unknown as Product;
  }
}
