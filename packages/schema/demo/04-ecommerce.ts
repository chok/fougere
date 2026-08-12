/**
 * Demo 4 — Exemple complet e-commerce
 *
 * Plusieurs entités, relations, dérivations pour API REST.
 */
import {
  entity, primary, text, number, bool, oneOf, ref, many, created, optional, json,
} from '../src/index.js';

// ─── Entités ─────────────────────────────────────

class Category extends entity({
  id: primary(),
  name: text({ min: 1, max: 100 }),
  slug: text({ pattern: '^[a-z0-9-]+$' }),
  description: optional(text()),
}) {}

class Product extends entity({
  id: primary(),
  categoryId: ref(Category),
  name: text({ min: 1, max: 255 }),
  slug: text({ pattern: '^[a-z0-9-]+$' }),
  price: number({ min: 0 }),
  stock: number({ min: 0, integer: true }),
  active: bool({ default: true }),
  metadata: json(),
  createdAt: created(),
}) {}

class Customer extends entity({
  id: primary(),
  firstName: text({ min: 1 }),
  lastName: text({ min: 1 }),
  email: text({ min: 5 }),
  createdAt: created(),
}) {}

class OrderLine extends entity({
  id: primary(),
  productId: ref(Product),
  quantity: number({ min: 1, integer: true }),
  unitPrice: number({ min: 0 }),
}) {}

class Order extends entity({
  id: primary(),
  customerId: ref(Customer),
  status: oneOf('draft', 'pending', 'paid', 'shipped', 'delivered', 'cancelled'),
  total: number({ min: 0 }),
  lines: many(OrderLine),
  note: optional(text()),
  createdAt: created(),
}) {}

// ─── Dérivations pour l'API ─────────────────────
// Dérivation nommée = classe : même rang qu'une Entity, vrai nom TypeScript.

// POST /products
class CreateProduct extends Product.pick('categoryId', 'name', 'slug', 'price', 'stock', 'metadata') {}

// PATCH /products/:id
class UpdateProduct extends Product.pick('name', 'price', 'stock', 'active', 'metadata').partial() {}

// GET /products (liste)
class ProductSummary extends Product.pick('id', 'name', 'slug', 'price', 'stock', 'active') {}

// GET /products/:id (détail)
class ProductDetail extends Product.extend({
  categoryName: text(),
}) {}

// POST /orders
class CreateOrder extends Order.pick('customerId', 'note') {}

// GET /orders (liste)
class OrderSummary extends Order.pick('id', 'status', 'total', 'createdAt') {}

// GET /orders/:id (détail avec données enrichies)
class OrderDetail extends Order.extend({
  customerName: text(),
  lineCount: number(),
}) {}

// ─── Simulation d'un flow API ───────────────────

console.log('=== Création produit ===');
const createInput = {
  categoryId: 'cat-1',
  name: 'Fougère en pot',
  slug: 'fougere-en-pot',
  price: 24.99,
  stock: 50,
  metadata: { weight: '500g', color: 'green' },
};
const createResult = CreateProduct.validate(createInput);
console.log('Valid:', createResult.success);

console.log('\n=== Mise à jour produit ===');
const updateInput = { price: 19.99, stock: 45 };
const updateResult = UpdateProduct.validate(updateInput);
console.log('Valid:', updateResult.success);

console.log('\n=== Création commande ===');
const orderInput = { customerId: 'cust-1', note: 'Livraison express' };
const orderResult = CreateOrder.validate(orderInput);
console.log('Valid:', orderResult.success);

console.log('\n=== Projection liste commandes ===');
const rawOrders = [
  { id: 'ord-1', customerId: 'cust-1', status: 'pending', total: 49.98, note: 'secret', createdAt: new Date() },
  { id: 'ord-2', customerId: 'cust-2', status: 'paid', total: 124.50, note: null, createdAt: new Date() },
];
const summaries = rawOrders.map(o => OrderSummary.from(o));
console.log(summaries);
// note et customerId sont absents — que id, status, total, createdAt

console.log('\n=== Validation échouée ===');
const badProduct = CreateProduct.validate({
  categoryId: 'cat-1',
  name: '',           // trop court
  slug: 'INVALID!',   // ne matche pas le pattern
  price: -5,           // négatif
  stock: 2.5,          // pas entier
  metadata: null,
});
if (!badProduct.success) {
  console.log('Errors:');
  for (const err of badProduct.errors) {
    console.log(`  ${err.path}: ${err.message}`);
  }
}
