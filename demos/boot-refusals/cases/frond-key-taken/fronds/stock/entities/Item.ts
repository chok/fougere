import { entity, primary, number, text } from '@fougere/schema';

export default class Line extends entity({
  id: primary(),
  item: text(),
  quantity: number({ min: 1 }),
}) {}
