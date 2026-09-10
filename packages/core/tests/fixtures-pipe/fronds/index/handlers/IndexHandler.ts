import type { Fact } from '@fougere/core';
import type PostPublished from '../../blog/entities/PostPublished.js';

export default class IndexHandler {
  /** Re-index what was published. */
  async reindex(fact: Fact<PostPublished>): Promise<void> {
    ((globalThis as Record<string, unknown>).__seen as unknown[]).push({ ...fact });
  }
}
