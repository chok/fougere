import { entity, primary, text, number } from '@fougere/schema';

export default class Product extends entity({
  id: primary(),
  name: text({ min: 1, max: 200 }),
  price: number({ min: 0 }),
  stock: number({ integer: true, min: 0 }),
}) {}
