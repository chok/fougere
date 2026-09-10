import type { Emit } from '@fougere/core';
import type PostPublished from '../entities/PostPublished.js';

/** The frond that owns publication. It names a subject, never a recipient. */
export default class PostHandler {
  constructor(private published: Emit<PostPublished>) {}

  /** Publish a draft, and say so — with the author it knows. */
  async publish(id: string): Promise<{ id: string }> {
    await this.published({ id, title: `post ${id}`, author: `u-${id}` });

    return { id };
  }
}
