import { Crud } from '@fougere/core';
import Product from '../entities/Product.js';

export class ListedInput extends Product.pick('id') {}

export default class ProductHandler extends Crud(Product) {
  /** Flip whether a product is listed. */
  async toggle(input: ListedInput): Promise<Product | undefined> {
    const product = await this.storage.findById(input.id);
    if (!product) return undefined;
    return this.storage.update(input.id, { listed: !product.listed });
  }
}
