import { entity, primary, text, auto, oneOf, readOnly } from '@fougere/schema';

export default class Post extends entity({
  id: primary(),
  title: text({ min: 1, max: 200 }),
  body: text(),
  createdAt: auto(),
  // Server-owned: born a draft, flipped by the publish operation.
  status: readOnly(oneOf('draft', 'published', { default: 'draft' })),
}) {}
