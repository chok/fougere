import Product from '../entities/Product.js';

const PRESENTER_TARGET = Symbol.for('fougere:presenter_target');

/** Presenter fixture — adds computed fields to Product. */
export default class ProductPresenter {
  static [PRESENTER_TARGET] = Product;

  displayPrice(products: { price: number }[]): string[] {
    return products.map((product) => `$${product.price.toFixed(2)}`);
  }

  isExpensive(products: { price: number }[]): boolean[] {
    return products.map((product) => product.price > 100);
  }
}
