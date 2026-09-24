import { frond, type FrondDescriptor } from '../../src/index.js';
import { op } from '../contract.js';
import Item from './fronds/shop/entities/Item.js';
import ItemHandler from './fronds/shop/handlers/ItemHandler.js';
import OrderHandler from './fronds/shop/handlers/OrderHandler.js';
import Clock from './fronds/shop/services/Clock.js';
import Ledger from './fronds/shop/services/Ledger.js';

const shop = frond('shop', {
  entities: [Item],
  providers: [Ledger, Clock],
  handlers: [
    { ctor: ItemHandler, deps: ['Ledger', 'Clock'], operations: { list: op({ cardinality: 'many' }) } },
    { ctor: OrderHandler, deps: ['Ledger', 'Clock'], operations: { list: op({ cardinality: 'many' }) } },
  ],
});

/** `kept` is what the scan reads off `implements AsyncDisposable`; `frond()` takes none, so the descriptor carries it. */
export default [{
  ...shop,
  providers: shop.providers.map((provider) => (provider.ctor === Ledger ? { ...provider, kept: true as const } : provider)),
}] satisfies FrondDescriptor[];
