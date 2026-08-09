import type { Fact } from '@fougere/core';
import type PostPublished from '../entities/PostPublished.js';

/** Identical to the single-repo demo — and it names no publisher. */
export default class IndexHandler {
  /** Re-index a post that has just been published. */
  async reindex(fact: Fact<PostPublished>): Promise<void> {
    console.log(
      `\x1b[36m  [search · pid ${process.pid}]\x1b[0m indexed \x1b[1m${fact.id}\x1b[0m — "${fact.title}"`,
    );
  }
}
