import { entity, primary, text } from '@fougere/schema';

/** The fact the blog owns: a post went out. */
export default class PostPublished extends entity({
  id: primary(),
  title: text({ min: 1 }),
}) {}
