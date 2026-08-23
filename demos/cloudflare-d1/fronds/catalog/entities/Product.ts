import { entity, primary, text, number, bool } from '@fougere/schema';

/** Nothing here knows it will run on a Worker. That is the whole demo. */
export default class Product extends entity({
  id: primary(),
  name: text({ min: 1, max: 200 }),
  sku: text({ min: 3, max: 32 }),
  cents: number({ min: 0, integer: true }),
  listed: bool(),
}, {
  unique: [['sku']],
}) {}
