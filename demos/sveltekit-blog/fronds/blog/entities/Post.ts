import { entity, primary, text, auto, oneOf, date, readOnly, optional } from '@fougere/schema';

/**
 * The same declaration `demos/nuxt-blog` uses, minus the author relation this demo
 * has no need for. Nothing in it names a host: `readOnly` closes the inbound door
 * for every surface at once, and `oneOf(...)` becomes a `CHECK` in the table, an
 * enum in GraphQL, a `<select>` in the form contract and a refusal at the façade.
 */
export default class Post extends entity({
  id: primary(),
  title: text({ min: 1, max: 200 }),
  body: text(),
  createdAt: auto(),
  // Server-owned pair: born draft, flipped by the publish OPERATION — never by a
  // client writing the field.
  status: readOnly(oneOf('draft', 'published', { default: 'draft' })),
  publishedAt: readOnly(optional(date())),
}) {}
