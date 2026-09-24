import Product from '../entities/Product.js';
import { Presenter } from '@fougere/core';

/** Presenter fixture — adds computed fields to Product. */
export default class ProductPresenter extends Presenter(Product) {
  displayPrice(products: { price: number }[]): string[] {
    return products.map((product) => `$${product.price.toFixed(2)}`);
  }

  isExpensive(products: { price: number }[]): boolean[] {
    return products.map((product) => product.price > 100);
  }
}
