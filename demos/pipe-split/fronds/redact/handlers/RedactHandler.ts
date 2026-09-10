import type { Pipe } from '@fougere/core';
import type PostPublished from '../../blog/entities/PostPublished.js';

/**
 * It FINISHES the fact: what it answers is what every subscriber then reads.
 *
 * `Pipe<PostPublished>` instead of `Fact<PostPublished>` — one word, and the difference is
 * that a subscriber's answer is discarded while this one becomes the fact. There is at most
 * one per fact, refused at boot otherwise: nothing would say which finished it.
 */
export default class RedactHandler {
  /** Set the address aside before anyone sees it. */
  async set(fact: Pipe<PostPublished>): Promise<PostPublished> {
    return { ...fact, email: null } as PostPublished;
  }
}
