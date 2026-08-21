import { entity, primary, text, number, updated } from '@fougere/schema';

/**
 * The local copy of a partner's book. `updated()` is not decoration: `refresh` reads
 * its high-water mark from this field, and `Mirror(Shape)` refuses a shape without one.
 */
export default class BookCard extends entity({
  isbn: primary(),
  title: text({ min: 1 }),
  author: text({ min: 1 }),
  priceCents: number({ min: 0 }),
  pulledAt: updated(),
}) {}
