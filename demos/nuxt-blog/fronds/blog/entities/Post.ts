import { entity, primary, text, ref, created, oneOf, date, readOnly, optional } from '@fougere/schema';
import Author from './Author.js';

export default class Post extends entity({
  id: primary(),
  title: text({ min: 1, max: 200 }),
  body: text(),
  authorId: ref(Author),
  createdAt: created(),
  // Server-owned pair: born draft, flipped by the publish OPERATION —
  // never by a client writing the field (readOnly closes the inbound door).
  status: readOnly(oneOf('draft', 'published', { default: 'draft' })),
  publishedAt: readOnly(optional(date())),
}) {}
