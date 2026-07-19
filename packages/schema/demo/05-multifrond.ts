/**
 * Demo 5 — Simulation multi-Frond
 *
 * Deux domaines (catalog, orders) avec exports et agrégation.
 * Simule ce que fougere fera en vrai avec les Fronds.
 */
import {
  entity, primary, text, number, oneOf, ref, many, auto, optional,
} from '../src/index.js';

// ─── Frond: catalog ─────────────────────────────

class Product extends entity({
  id: primary(),
  name: text({ min: 1 }),
  price: number({ min: 0 }),
  stock: number({ min: 0, integer: true }),
}) {}

// Ce que catalog exporte — une classe, comme toute dérivation nommée
class ProductSummary extends Product.pick('id', 'name', 'price') {}

// ─── Frond: orders ──────────────────────────────

class Customer extends entity({
  id: primary(),
  name: text({ min: 1 }),
  email: text(),
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
  status: oneOf('pending', 'paid', 'shipped'),
  total: number({ min: 0 }),
  lines: many(OrderLine),
  createdAt: auto(),
}) {}

// Dérivations pour le domaine orders
class CreateOrder extends Order.pick('customerId') {}
class OrderSummary extends Order.pick('id', 'status', 'total', 'createdAt') {}

// ─── App: storefront (agrégation cross-frond) ───

// L'App compose des données de plusieurs Fronds
// Ce schema n'existe dans aucun domaine — c'est une vue de présentation

class OrderPageView extends Order.pick('id', 'status', 'total', 'createdAt').extend({
  customerName: text(),
  lines: many(OrderLine),    // avec les détails
}) {}

// Simulation : le service de l'App agrège
function buildOrderPage(
  order: { id: string; status: string; total: number; createdAt: Date; customerId: string },
  customer: { name: string },
  lines: Array<{ id: string; productId: string; quantity: number; unitPrice: number }>,
) {
  return OrderPageView.from({
    id: order.id,
    status: order.status,
    total: order.total,
    createdAt: order.createdAt,
    customerName: customer.name,
    lines,
  });
}

// ─── Simulation ─────────────────────────────────

console.log('=== Frond catalog: ProductSummary ===');
console.log(Object.keys(ProductSummary.getFields()));

console.log('\n=== Frond orders: CreateOrder validation ===');
console.log(CreateOrder.validate({ customerId: 'cust-1' }));

console.log('\n=== Frond orders: OrderSummary projection ===');
const rawOrder = {
  id: 'ord-1',
  customerId: 'cust-1',
  status: 'pending',
  total: 59.98,
  lines: [],
  createdAt: new Date(),
};
console.log(OrderSummary.from(rawOrder));

console.log('\n=== App storefront: OrderPageView (agrégat) ===');
const page = buildOrderPage(
  { id: 'ord-1', status: 'pending', total: 59.98, createdAt: new Date(), customerId: 'cust-1' },
  { name: 'Jean Dupont' },
  [
    { id: 'li-1', productId: 'prod-1', quantity: 2, unitPrice: 29.99 },
  ],
);
console.log(page);
