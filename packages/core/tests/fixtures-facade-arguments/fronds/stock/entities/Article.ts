import { entity, primary, text, number } from '@fougere/schema';

export default class Article extends entity({
  id: primary(),
  sku: text({ min: 1 }),
  quantity: number({ min: 0 }),
}) {}
