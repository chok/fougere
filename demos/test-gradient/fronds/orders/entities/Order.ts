import { entity, primary, text, number, created } from '@fougere/schema';

export default class Order extends entity({
  id: primary(),
  sku: text({ min: 3, max: 12 }),
  quantity: number({ integer: true, min: 1, max: 99 }),
  placedAt: created(),
}) {}
