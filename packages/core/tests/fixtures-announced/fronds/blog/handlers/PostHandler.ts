import type { Emit } from '@fougere/core';
import type PostPublished from '../entities/PostPublished.js';

/** The announcer. It names a subject, so nothing here names a frond. */
export default class PostHandler {
  constructor(private published: Emit<PostPublished>) {}

  /** Publish a draft, and say so. */
  async publish(id: string): Promise<{ id: string }> {
    await this.published({ id, title: `post ${id}` });

    return { id };
  }
}
