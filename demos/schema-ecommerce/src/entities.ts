/**
 * Entités fougere — source de vérité unique
 */
import { entity, primary, text, number, oneOf, ref, auto, optional, bool } from '@fougere/schema';

// ─── Entités ─────────────────────────────────────

export class Category extends entity({
  id: primary(),
  name: text({ min: 1, max: 100 }),
  slug: text({ pattern: '^[a-z0-9-]+$' }),
}) {}

export class Product extends entity({
  id: primary(),
  categoryId: ref(Category),
  name: text({ min: 1, max: 255 }),
  price: number({ min: 0 }),
  stock: number({ min: 0, integer: true }),
  active: bool({ default: true }),
  createdAt: auto(),
}) {}

export class Customer extends entity({
  id: primary(),
  firstName: text({ min: 1 }),
  lastName: text({ min: 1 }),
  email: text({ min: 5 }),
  createdAt: auto(),
}) {}

export class OrderLine extends entity({
  id: primary(),
  orderId: text(),
  productId: ref(Product),
  quantity: number({ min: 1, integer: true }),
  unitPrice: number({ min: 0 }),
}) {}

export class Order extends entity({
  id: primary(),
  customerId: ref(Customer),
  status: oneOf('draft', 'pending', 'paid', 'shipped', 'cancelled'),
  total: number({ min: 0 }),
  note: optional(text()),
  createdAt: auto(),
}) {}

// ─── Dérivations ─────────────────────────────────

// Inputs écriture
export class CreateProduct extends Product.pick('categoryId', 'name', 'price', 'stock') {}
export class UpdateProduct extends Product.pick('name', 'price', 'stock', 'active').partial() {}
export class CreateOrder extends Order.pick('customerId', 'note') {}
export class UpdateOrder extends Order.pick('status', 'note').partial() {}

// Vues lecture
export class ProductSummary extends Product.pick('id', 'name', 'price', 'stock', 'active') {}
export class ProductDetail extends Product.omit('categoryId') {}
export class OrderSummary extends Order.pick('id', 'status', 'total', 'createdAt') {}
export class CustomerPublic extends Customer.omit('email') {}
