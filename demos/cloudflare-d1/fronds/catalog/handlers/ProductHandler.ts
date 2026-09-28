import { Crud } from '@fougere/core';
import Product from '../entities/Product.js';

export class ListedInput extends Product.pick('id') {}

export default class ProductHandler extends Crud(Product) {
  /** Flip whether a product is listed. */
  async toggle(input: ListedInput): Promise<Product | undefined> {
    const product = await super.findById(input.id);
    if (!product) return undefined;

    return super.update(input.id, { listed: !product.listed });
  }
}
