import { entity, text, optional, created } from '@fougere/schema';

/**
 * A fact, and one field a reader has no business seeing.
 *
 * Nothing marks it as a fact: it becomes one because somebody writes `Emit<PostPublished>`
 * about it — or `Pipe<PostPublished>`, which is the same subject before it is final.
 */
export default class PostPublished extends entity({
  id: text({ min: 1 }),
  title: text({ min: 1 }),
  /** The author's address. It leaves the frond that owns it, and it should not. */
  email: optional(text()),
  at: created(),
}) {}
