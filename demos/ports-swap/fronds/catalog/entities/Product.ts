import { entity, primary, text } from '@fougere/schema';

export default class Product extends entity({
  id: primary(),
  title: text({ min: 1 }),
}) {}
