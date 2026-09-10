import type { Fact } from '@fougere/core';
import type PostPublished from '../../blog/entities/PostPublished.js';

/** A subscriber. It reads the end of the chain, and cannot tell there was one. */
export default class IndexHandler {
  /** Re-index what was published. */
  async reindex(fact: Fact<PostPublished>): Promise<void> {
    console.log(`    index reads  author=${fact.author}  account=${fact.account}`);
  }
}
