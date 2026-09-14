import type { Pipe } from '@fougere/core';
import type PostPublished from '../../blog/entities/PostPublished.js';

/** A link finishes the fact before anyone reads it, and it is called like a subscriber. */
export default class HashHandler {
  /** Replace the title with what a reader may know of it. */
  async set(fact: Pipe<PostPublished>): Promise<PostPublished> {
    return { ...fact, title: `post ${fact.id}` } as PostPublished;
  }
}
