import { entity, primary, text, auto, oneOf, date, readOnly, optional } from '@fougere/schema';

export default class Post extends entity({
  id: primary(),
  slug: text({ min: 1, max: 80 }),
  title: text({ min: 1, max: 160 }),
  summary: optional(text({ max: 300 })),
  body: optional(text()),
  // Server-owned: stamped from the session at create, never client-written.
  authorId: readOnly(text()),
  authorName: readOnly(optional(text())),
  createdAt: auto(),
  // Server-owned pair: born draft, flipped by the publish OPERATION —
  // never by a client writing the field (readOnly closes the inbound door).
  status: readOnly(oneOf('draft', 'published', { default: 'draft' })),
  publishedAt: readOnly(optional(date())),
}) {}
