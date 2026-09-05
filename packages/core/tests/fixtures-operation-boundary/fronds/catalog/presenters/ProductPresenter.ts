import { Presenter } from '@fougere/core';
import { trace } from '../../../trace.js';
import Product from '../entities/Product.js';

export default class ProductPresenter extends Presenter(Product) {
  shouted(products: Product[]): string[] {
    trace.push('present');

    return products.map((product) => product.name.toUpperCase());
  }
}
