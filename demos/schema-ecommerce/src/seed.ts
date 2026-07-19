/**
 * Seed — données de demo
 */
import { db } from './db.js';
import * as tables from './adapter-drizzle.js';

function uuid() {
  return crypto.randomUUID();
}

const now = new Date().toISOString();

// Categories
const catPlants = uuid();
const catPots = uuid();

db.insert(tables.categories).values([
  { id: catPlants, name: 'Plantes', slug: 'plantes' },
  { id: catPots, name: 'Pots', slug: 'pots' },
]).run();

// Products
const prod1 = uuid();
const prod2 = uuid();
const prod3 = uuid();

db.insert(tables.products).values([
  { id: prod1, categoryId: catPlants, name: 'Fougère de Boston', price: 24.99, stock: 50, active: true, createdAt: now },
  { id: prod2, categoryId: catPlants, name: 'Fougère Maidenhair', price: 19.99, stock: 30, active: true, createdAt: now },
  { id: prod3, categoryId: catPots, name: 'Pot en terre cuite', price: 12.50, stock: 100, active: true, createdAt: now },
]).run();

// Customers
const cust1 = uuid();
const cust2 = uuid();

db.insert(tables.customers).values([
  { id: cust1, firstName: 'Jean', lastName: 'Dupont', email: 'jean@example.com', createdAt: now },
  { id: cust2, firstName: 'Marie', lastName: 'Martin', email: 'marie@example.com', createdAt: now },
]).run();

// Orders
const ord1 = uuid();

db.insert(tables.orders).values([
  { id: ord1, customerId: cust1, status: 'paid', total: 62.48, note: 'Livraison express', createdAt: now },
]).run();

db.insert(tables.orderLines).values([
  { id: uuid(), orderId: ord1, productId: prod1, quantity: 2, unitPrice: 24.99 },
  { id: uuid(), orderId: ord1, productId: prod3, quantity: 1, unitPrice: 12.50 },
]).run();

console.log('Seeded:');
console.log(`  2 categories`);
console.log(`  3 products`);
console.log(`  2 customers`);
console.log(`  1 order with 2 lines`);
