import type { Pipe } from '@fougere/core';
import type PostPublished from '../../blog/entities/PostPublished.js';

/**
 * The SECOND link. It runs after redaction, and sees what redaction answered — which is
 * what makes them a chain and not two opinions.
 */
export default class StampHandler {
  /** Say where the fact was finished, once it is. */
  async set(fact: Pipe<PostPublished>): Promise<PostPublished> {
    return { ...fact, title: `${fact.title} [redacted=${fact.email === null}]` } as PostPublished;
  }
}
