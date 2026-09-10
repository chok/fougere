import { optional, text, created } from '@fougere/schema';
import Post from './Post.js';

/**
 * A fact, and it is a PROJECTION of the entity it is about.
 *
 * `email` is absent because a fact that should not carry it does not declare it — omission
 * is the schema's work, and it needs no link. What a link is for is what remains and must
 * be TRANSFORMED: `author` must reach a reader as a hash, not as an id, and a hash is not
 * something `pick` can produce.
 */
export default class PostPublished extends Post.pick('id', 'title', 'author').extend({
  /** Filled by a link — the blog does not hold accounts. */
  account: optional(text()),
  at: created(),
}) {}
