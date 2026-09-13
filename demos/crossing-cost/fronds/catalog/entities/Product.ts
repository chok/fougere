import { entity, number, primary, text } from '@fougere/schema';

export default class Product extends entity({
  id: primary(),
  title: text({ min: 1 }),
  cents: number({ min: 0 }),
}) {}
