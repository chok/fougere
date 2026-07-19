import Product from '../entities/Product.js';

const PRESENTER_TARGET = Symbol.for('fougere:presenter_target');

/** Presenter fixture — adds computed fields to Product. */
export default class ProductPresenter {
  static [PRESENTER_TARGET] = Product;

  displayPrice(product: { price: number }): string {
    return `$${product.price.toFixed(2)}`;
  }

  isExpensive(product: { price: number }): boolean {
    return product.price > 100;
  }
}
