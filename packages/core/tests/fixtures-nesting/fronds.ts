import { frond } from '../../src/index.js';
import { op } from '../contract.js';
import Post from './fronds/blog/entities/Post.js';
import PostHandler from './fronds/blog/handlers/PostHandler.js';
import Cart from './fronds/cart/entities/Cart.js';
import CartHandler from './fronds/cart/handlers/CartHandler.js';
import Product from './fronds/catalog/entities/Product.js';
import Money from './fronds/shop/services/Money.js';

export const blog = frond('blog', {
  entities: [Post],
  handlers: [{
    ctor: PostHandler,
    deps: ['Money'],
    operations: { quote: op({ cardinality: 'none', description: 'What a post costs, which is a question it should not be able to ask.' }) },
  }],
});

export const cart = frond('cart', {
  entities: [Cart],
  handlers: [{ ctor: CartHandler, deps: ['Money'], operations: { quote: op({ cardinality: 'none', description: 'What the cart costs.' }) } }],
});

export const catalog = frond('catalog', { entities: [Product] });

export const shop = frond('shop', { providers: [Money] });

export default [blog, cart, catalog, shop];
