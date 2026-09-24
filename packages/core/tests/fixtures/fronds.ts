import { frond } from '../../src/index.js';
import { input, op, param } from '../contract.js';
import Brand from './fronds/catalog/entities/Brand.js';
import Product from './fronds/catalog/entities/Product.js';
import ProductHandler, { SearchInput, SearchOutput } from './fronds/catalog/handlers/ProductHandler.js';
import ProductPresenter from './fronds/catalog/presenters/ProductPresenter.js';
import ProductService from './fronds/catalog/services/ProductService.js';
import Item from './fronds/inventory/entities/Item.js';
import ItemHandler from './fronds/inventory/handlers/ItemHandler.js';
import StockHandler, { StockSearchInput, StockSearchOutput } from './fronds/inventory/handlers/StockHandler.js';
import OrderRepository from './fronds/orders/repositories/OrderRepository.js';
import OrderService from './fronds/orders/services/OrderService.js';

export default [
  frond('catalog', {
    entities: [Brand, Product],
    providers: [ProductService],
    presenters: [ProductPresenter],
    handlers: [{
      ctor: ProductHandler,
      deps: ['ProductRepository'],
      operations: {
        list: op({ output: SearchOutput, cardinality: 'many' }),
        findById: op({ args: [param('id')], output: SearchOutput, cardinality: 'maybe' }),
        search: op({
          args: [input()],
          input: SearchInput,
          output: SearchOutput,
          cardinality: 'many',
          description: 'Find products by name.',
        }),
      },
    }],
  }),
  frond('inventory', {
    entities: [Item],
    handlers: [
      ItemHandler,
      {
        ctor: StockHandler,
        operations: {
          list: op({ output: Item, cardinality: 'page' }),
          searchStock: op({ args: [input()], input: StockSearchInput, output: StockSearchOutput, cardinality: 'many' }),
        },
      },
    ],
  }),
  frond('orders', {
    providers: [{ ctor: OrderService, deps: ['OrderRepository', 'Logger'] }, OrderRepository],
  }),
];
