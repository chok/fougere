import { entity, primary, number, text } from '@fougere/schema';

/** The fact. */
export default class ItemPriced extends entity({
  id: primary(),
  label: text(),
  price: number({ min: 0 }),
}) {}
