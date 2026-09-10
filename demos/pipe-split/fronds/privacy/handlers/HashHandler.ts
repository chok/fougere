import type { Pipe } from '@fougere/core';
import type PostPublished from '../../blog/entities/PostPublished.js';
import Salt from '../services/Salt.js';

/**
 * The SECOND link. An author reaches a reader as a hash — countable, not identifiable.
 *
 * `pick` cannot do this: dropping `author` would lose the count, keeping it would leak the
 * id. Only a transform holds both, and it must run AFTER the tenant lookup, which needs
 * the id it replaces. That is why the order is declared and not left to chance.
 */
export default class HashHandler {
  constructor(private salt: Salt) {}

  /** Replace the author with what a reader may know of them. */
  async set(fact: Pipe<PostPublished>): Promise<PostPublished> {
    return { ...fact, author: this.salt.hash(fact.author) } as PostPublished;
  }
}
