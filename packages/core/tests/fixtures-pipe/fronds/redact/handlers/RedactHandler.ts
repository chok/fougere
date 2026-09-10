import type { Pipe } from '@fougere/core';
import type PostPublished from '../../blog/entities/PostPublished.js';

/** Finishes the fact: what it answers is what every subscriber then reads. */
export default class RedactHandler {
  /** Set the address aside before anyone sees it. */
  async set(fact: Pipe<PostPublished>): Promise<PostPublished> {
    return { ...fact, email: null } as PostPublished;
  }
}
