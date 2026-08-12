/**
 * Demo 3 — Dérivation (pick, omit, partial, extend)
 *
 * Une seule Entity, plusieurs vues pour différents cas d'usage.
 */
import { entity, primary, text, number, oneOf, created, optional, ref } from '../src/index.js';

class Customer extends entity({
  id: primary(),
  name: text({ min: 1 }),
  email: text(),
}) {}

class Order extends entity({
  id: primary(),
  customerId: ref(Customer),
  status: oneOf('pending', 'paid', 'shipped'),
  total: number({ min: 0 }),
  note: optional(text()),   // nullable — donc effaçable par un patch
  createdAt: created(),
}) {}

// --- Input pour créer une commande (POST /orders) ---
// Une dérivation nommée est une CLASSE, comme l'Entity de base : elle gagne un
// vrai nom TypeScript (erreurs lisibles, utilisable directement comme type).
class CreateOrder extends Order.pick('customerId', 'note') {}

console.log('--- CreateOrder fields ---');
console.log(Object.keys(CreateOrder.getFields()));
// ['customerId', 'note']

console.log('\n--- CreateOrder validation ---');
console.log(CreateOrder.validate({ customerId: 'cust-1', note: 'Urgent' }));
// success: true

console.log(CreateOrder.validate({}));
// success: false (customerId required)


// --- Input pour mettre à jour (PATCH /orders/:id) ---
class UpdateOrder extends Order.pick('status', 'note').partial() {}

console.log('\n--- UpdateOrder fields ---');
console.log(Object.keys(UpdateOrder.getFields()));
// ['status', 'note']

console.log('\n--- UpdateOrder validation (mode patch) ---');
// partial() déplace l'axe PRÉSENCE (tout champ devient omissible), jamais
// l'axe NULLITÉ (null reste gouverné par le champ de base). Quatre cas :
console.log(UpdateOrder.validate({ status: 'paid' }));
// data: { status: 'paid' } — note ABSENTE reste absente ("ne pas toucher")

console.log(UpdateOrder.validate({ note: null }));
// data: { note: null } — note est optional() : null légal ("effacer")

console.log(UpdateOrder.validate({ status: null }));
// success: false — status n'est PAS nullable : un patch ne peut pas l'effacer

console.log(UpdateOrder.validate({}));
// data: {} — patch vide, rien à toucher


// --- Résumé pour une liste (GET /orders) ---
class OrderSummary extends Order.pick('id', 'status', 'total', 'createdAt') {}

console.log('\n--- OrderSummary projection ---');
const raw = {
  id: 'ord-1',
  customerId: 'cust-1',
  status: 'pending',
  total: 100,
  note: 'Should be dropped',
  createdAt: new Date(),
};
console.log(OrderSummary.from(raw));
// { id: 'ord-1', status: 'pending', total: 100, createdAt: Date }


// --- Détail enrichi (GET /orders/:id) ---
class OrderDetail extends Order.extend({
  customerName: text(),
  lineCount: number(),
}) {}

console.log('\n--- OrderDetail fields ---');
console.log(Object.keys(OrderDetail.getFields()));
// [...tous les champs Order, 'customerName', 'lineCount']


// --- Chaînage ---
// Les dérivations composent : chaque étape retourne le même constructeur de
// schema, la classe finale nomme le résultat de la chaîne.
class PublicOrder extends Order.omit('note').pick('id', 'status', 'total') {}

console.log('\n--- PublicOrder fields ---');
console.log(Object.keys(PublicOrder.getFields()));
// ['id', 'status', 'total']
