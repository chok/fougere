import { frond } from '../../src/index.js';
import { input, op } from '../contract.js';
import Product from './fronds/catalog/entities/Product.js';
import ProductHandler from './fronds/catalog/handlers/ProductHandler.js';
import ProductPresenter from './fronds/catalog/presenters/ProductPresenter.js';

export default [
  frond('catalog', {
    entities: [Product],
    presenters: [ProductPresenter],
    handlers: [{
      ctor: ProductHandler,
      operations: { create: op({ args: [input()], input: Product, output: Product, cardinality: 'one' }) },
    }],
  }),
];
