import { entity, primary, text, number } from '@fougere/schema';

export default class Product extends entity({
  id: primary(),
  title: text(),
  stock: number({ min: 0 }),
}) {}
