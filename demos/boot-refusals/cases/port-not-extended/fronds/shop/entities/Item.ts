import { entity, primary, number, text } from '@fougere/schema';

export default class Item extends entity({
  id: primary(),
  label: text(),
  price: number({ min: 0 }),
}) {}
