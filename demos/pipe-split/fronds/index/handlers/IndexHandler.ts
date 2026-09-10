import type { Fact } from '@fougere/core';
import type PostPublished from '../../blog/entities/PostPublished.js';

/** A subscriber. It reads what the link answered, and cannot tell there was one. */
export default class IndexHandler {
  /** Re-index what was published. */
  async reindex(fact: Fact<PostPublished>): Promise<void> {
    console.log(`    index  → ${fact.id}  email=${JSON.stringify(fact.email)}`);
  }
}
