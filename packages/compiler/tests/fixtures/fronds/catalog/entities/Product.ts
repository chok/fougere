import { entity, primary, text, number } from '@fougere/schema';

/** Entity fixture — has a matching ProductService (should NOT auto-wire). */
export default class Product extends entity({
  id: primary(),
  name: text(),
  price: number({ min: 0 }),
}) {}
