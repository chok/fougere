/**
 * Demo 2 — Relations entre entités (ref, many)
 */
import { entity, primary, text, number, ref, many, oneOf, created } from '../src/index.js';

class Customer extends entity({
  id: primary(),
  name: text({ min: 1 }),
  email: text({ pattern: '.*@.*' }),
}) {}

class OrderLine extends entity({
  id: primary(),
  productId: text(),
  quantity: number({ min: 1, integer: true }),
  unitPrice: number({ min: 0 }),
}) {}

class Order extends entity({
  id: primary(),
  customerId: ref(Customer),
  status: oneOf('pending', 'paid', 'shipped', 'cancelled'),
  total: number({ min: 0 }),
  lines: many(OrderLine),
  createdAt: created(),
}) {}

// Les fields connaissent les relations
console.log('--- Order fields ---');
const fields = Order.getFields();
for (const [name, field] of Object.entries(fields)) {
  const rel = field.role?.relation;
  if (rel) {
    console.log(`  ${name}: relation:${rel.kind} → ${rel.to().name}`);
  } else {
    console.log(`  ${name}: ${field.shape?.type}`);
  }
}

// Validation avec ref (stocke l'ID, pas l'objet)
console.log('\n--- Validation Order ---');
const result = Order.validate({
  id: 'ord-001',
  customerId: 'cust-001',     // c'est un ID (string), pas un objet Customer
  status: 'pending',
  total: 59.98,
  lines: [                     // many = tableau
    { id: 'li-1', productId: 'prod-1', quantity: 2, unitPrice: 29.99 },
  ],
});
console.log(result);
