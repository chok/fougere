import { entity, primary, text, created, oneOf, readOnly } from '@fougere/schema';

export default class Post extends entity({
  id: primary(),
  title: text({ min: 1, max: 200 }),
  body: text(),
  createdAt: created(),
  // Server-owned: a post is born a draft and flipped by the publish
  // operation, never by a client writing the field. readOnly closes
  // the inbound door — the field is projected out, never accepted in.
  status: readOnly(oneOf('draft', 'published', { default: 'draft' })),
}) {}
