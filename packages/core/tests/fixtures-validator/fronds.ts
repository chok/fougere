import { frond } from '../../src/index.js';
import Product from './fronds/shop/entities/Product.js';
import ProductHandler from './fronds/shop/handlers/ProductHandler.js';

export default [frond('shop', { entities: [Product], handlers: [ProductHandler] })];
