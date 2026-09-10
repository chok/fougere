import type { Emit } from '@fougere/core';
import type PostPublished from '../entities/PostPublished.js';

export default class PostHandler {
  constructor(private published: Emit<PostPublished>) {}

  /** Publish a draft, and say so — with something a reader should not see. */
  async publish(id: string): Promise<{ id: string }> {
    await this.published({ id, title: `post ${id}`, email: 'reader@example.com' });

    return { id };
  }
}
