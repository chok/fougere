import type { Fact } from '@fougere/core';
import type PostPublished from '../../blog/entities/PostPublished.js';

/** A subscriber in another frond. Accepting the fact IS the subscription. */
export default class IndexHandler {
  /** Re-index what was published. */
  async reindex(fact: Fact<PostPublished>): Promise<void> {
    void fact;
  }
}
