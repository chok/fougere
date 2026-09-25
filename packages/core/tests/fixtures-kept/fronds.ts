import { frond } from '../../src/index.js';
import { op } from '../contract.js';
import Item from './fronds/shop/entities/Item.js';
import ItemHandler from './fronds/shop/handlers/ItemHandler.js';
import OrderHandler from './fronds/shop/handlers/OrderHandler.js';
import Clock from './fronds/shop/services/Clock.js';
import Ledger from './fronds/shop/services/Ledger.js';

export default [
  frond('shop', {
    entities: [Item],
    providers: [Ledger, Clock],
    handlers: [
      { ctor: ItemHandler, deps: ['Ledger', 'Clock'], operations: { list: op({ cardinality: 'many' }) } },
      { ctor: OrderHandler, deps: ['Ledger', 'Clock'], operations: { list: op({ cardinality: 'many' }) } },
    ],
  }),
];
