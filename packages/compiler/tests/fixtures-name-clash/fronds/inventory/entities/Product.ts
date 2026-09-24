import { entity, primary, number } from '@fougere/schema';

/** The same word, a different subject: what sits on a shelf. */
export default class Product extends entity({
  id: primary(),
  onHand: number({ min: 0 }),
}) {}
