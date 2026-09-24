import { entity, primary, text } from '@fougere/schema';

/** What the shop sells. */
export default class Product extends entity({
  id: primary(),
  name: text({ min: 1 }),
}) {}
