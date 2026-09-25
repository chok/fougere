import { entity, primary, text, created, optional, date, readOnly } from '@fougere/schema';

export default class Post extends entity({
  id: primary(),
  title: text({ min: 1, max: 200 }),
  body: text(),
  createdAt: created(),
  publishedAt: readOnly(optional(date())),
}) {}
