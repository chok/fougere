import { entity, number, primary, text } from '@fougere/schema';

export default class Order extends entity({
  id: primary(),
  product: text({ min: 1 }),
  cents: number({ min: 0 }),
}) {}
