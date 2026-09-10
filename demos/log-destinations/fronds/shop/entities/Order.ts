import { entity, primary, text, number } from '@fougere/schema';

export default class Order extends entity({
  id: primary(),
  sku: text({ min: 1 }),
  cents: number({ integer: true, min: 1 }),
}) {}
