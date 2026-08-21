import { entity, primary, text, number, oneOf, created } from '@fougere/schema';

export default class Product extends entity({
  id: primary(),
  sku: text({ min: 3, max: 12 }),
  name: text({ min: 1, max: 60 }),
  cents: number({ integer: true, min: 1, max: 1_000_000 }),
  status: oneOf('draft', 'listed', 'withdrawn'),
  createdAt: created(),
}) {}
