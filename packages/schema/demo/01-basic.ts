/**
 * Demo 1 — Définition basique d'une entité
 */
import { entity, primary, text, number, bool, created, anatomy } from '../src/index.js';

// Une classe = une entité. Pas de decorators, pas de chaînage.
class Product extends entity({
  id: primary(),
  name: text({ min: 1, max: 255 }),
  price: number({ min: 0 }),
  stock: number({ min: 0, integer: true }),
  active: bool({ default: true }),
  createdAt: created(),
}) {}

// Introspection
console.log('--- Fields ---');
const fields = Product.getFields();
for (const [name, field] of Object.entries(fields)) {
  const { base, nullable } = anatomy(field.shape);
  const kind = base?.type ?? (field.role?.relation ? `relation:${field.role.relation.kind}` : 'unknown');
  console.log(`  ${name}: ${kind}${nullable ? ' (nullable)' : ''}`);
}

// Validation — données valides
console.log('\n--- Validation (valide) ---');
const valid = Product.validate({
  id: 'prod-001',
  name: 'T-shirt',
  price: 29.99,
  stock: 150,
  active: true,
});
console.log(valid);

// Validation — données invalides
console.log('\n--- Validation (invalide) ---');
const invalid = Product.validate({
  id: 'prod-002',
  name: '',         // trop court (min: 1)
  price: -10,       // négatif (min: 0)
  stock: 3.5,       // pas entier (integer: true)
});
console.log(invalid);

// Projection
console.log('\n--- Projection (from) ---');
const projected = Product.from({
  id: 'prod-001',
  name: 'T-shirt',
  price: 29.99,
  stock: 150,
  active: true,
  randomJunk: 'should be dropped',
});
console.log(projected);
