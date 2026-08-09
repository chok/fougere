import type { Fact } from '@fougere/core';
import type PostPublished from '../../blog/entities/PostPublished.js';

/**
 * Another frond, no entity of its own, and nothing registered anywhere.
 *
 * The global is how the test observes: the scanner loads a fixture through its own
 * loader, so a module-level array here and the one the test imports would be two objects.
 */
export default class IndexHandler {
  /** Re-index a post that has just been published. */
  async reindex(fact: Fact<PostPublished>): Promise<void> {
    ((globalThis as any).__heard ??= []).push(`search:${fact.id}`);
  }
}
