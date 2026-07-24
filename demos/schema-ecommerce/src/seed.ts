/**
 * Seed — données de demo
 */
import { categoryOrm, productOrm, customerOrm, orderOrm, orderLineOrm } from './db.js';

// Categories
const plantes = await categoryOrm.create({ name: 'Plantes', slug: 'plantes' });
const pots = await categoryOrm.create({ name: 'Pots', slug: 'pots' });

// Products — active/createdAt are realised by the ORM (SQL default, auto timestamp)
const prod1 = await productOrm.create({ categoryId: plantes.id, name: 'Fougère de Boston', price: 24.99, stock: 50 });
const prod2 = await productOrm.create({ categoryId: plantes.id, name: 'Fougère Maidenhair', price: 19.99, stock: 30 });
const prod3 = await productOrm.create({ categoryId: pots.id, name: 'Pot en terre cuite', price: 12.50, stock: 100 });

// Customers
const cust1 = await customerOrm.create({ firstName: 'Jean', lastName: 'Dupont', email: 'jean@example.com' });
await customerOrm.create({ firstName: 'Marie', lastName: 'Martin', email: 'marie@example.com' });

// Orders
const order = await orderOrm.create({
  customerId: cust1.id,
  status: 'paid',
  total: 62.48,
  note: 'Livraison express',
});

await orderLineOrm.create({ orderId: order.id, productId: prod1.id, quantity: 2, unitPrice: 24.99 });
await orderLineOrm.create({ orderId: order.id, productId: prod3.id, quantity: 1, unitPrice: 12.50 });

console.log('Seeded:');
console.log(`  2 categories`);
console.log(`  3 products`);
console.log(`  2 customers`);
console.log(`  1 order with 2 lines`);
