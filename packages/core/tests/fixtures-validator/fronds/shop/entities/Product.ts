import { entity, primary, text, number, oneOf, created, immutable, readOnly } from '@fougere/schema';

/**
 * One instance of each way an input can be refused, so a single payload
 * exercises every branch of the judge's decision table at once.
 */
export default class Product extends entity({
  id: primary(),
  /** shape — bounds on a string */
  name: text({ min: 2, max: 40 }),
  /** shape — bounds on a number */
  price: number({ min: 0, max: 1000 }),
  /** shape — a bounded set */
  status: oneOf('draft', 'published'),
  /** lifecycle — server-stamped, refused in a patch */
  createdAt: immutable(created()),
  /** boundary — computed by the frond, never accepted inbound */
  slug: readOnly(text()),
}) {}
