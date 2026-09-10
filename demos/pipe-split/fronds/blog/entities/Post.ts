import { entity, primary, text } from '@fougere/schema';

/** What the blog holds. The author's address is here, and it never leaves. */
export default class Post extends entity({
  id: primary(),
  title: text({ min: 1 }),
  author: text({ min: 1 }),
  email: text(),
}) {}
