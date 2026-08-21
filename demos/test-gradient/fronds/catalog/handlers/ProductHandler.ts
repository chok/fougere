import { Crud, type EntityOrm } from '@fougere/core';
import Product from '../entities/Product.js';
import Pricing from '../services/Pricing.js';

export default class ProductHandler extends Crud(Product) {
  constructor(orm: EntityOrm<Product>, private pricing: Pricing) {
    super(orm);
  }

  /** The price a buyer pays, rate included. */
  async quote(input: Product): Promise<{ sku: string; total: number }> {
    return { sku: input.sku, total: this.pricing.total(input.cents) };
  }
}
