import { frond } from '../../src/index.js';
import { op, param } from '../contract.js';
import Product from './fronds/shop/entities/Product.js';
import ProductHandler from './fronds/shop/handlers/ProductHandler.js';
import ProductRepository from './fronds/shop/services/ProductRepository.js';
import Counting from './fronds/shop/services/Counting.js';
import Crate from './fronds/warehouse/entities/Crate.js';
import CrateHandler from './fronds/warehouse/handlers/CrateHandler.js';
import CrateRepository from './fronds/warehouse/services/CrateRepository.js';

export default [
  frond('shop', {
    entities: [Product],
    providers: [{ ctor: Counting, deps: ['Storage'] }, { ctor: ProductRepository, repository: Product }],
    handlers: [{
      ctor: ProductHandler,
      deps: ['ProductRepository'],
      operations: {
        add: op({ args: [param('title')], cardinality: 'none', description: 'Write one row.' }),
        list: op({ cardinality: 'none', description: 'Read them back — a gesture the wrapper says nothing about.' }),
      },
    }],
  }),
  frond('warehouse', {
    entities: [Crate],
    providers: [{ ctor: CrateRepository, repository: Crate }],
    handlers: [{
      ctor: CrateHandler,
      deps: ['CrateRepository'],
      operations: { add: op({ args: [param('label')], cardinality: 'none', description: 'Store one crate.' }) },
    }],
  }),
];
