import type { Emit } from '@fougere/core';
import type PostPublished from '../entities/PostPublished.js';

/** The frond that owns publication. It names a subject, never a recipient. */
export default class PostHandler {
  constructor(private published: Emit<PostPublished>) {}

  /** Publish a draft, and say so — address included, because that is what it knows. */
  async publish(id: string): Promise<{ id: string }> {
    await this.published({ id, title: `post ${id}`, email: `author-${id}@example.com` });

    return { id };
  }
}
