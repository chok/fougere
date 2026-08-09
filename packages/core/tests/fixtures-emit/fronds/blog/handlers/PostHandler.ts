import type { Emit } from '@fougere/core';
import type PostPublished from '../entities/PostPublished.js';

/** The frond that owns publication. It names a subject, never a recipient. */
export default class PostHandler {
  constructor(private published: Emit<PostPublished>) {}

  /** Publish a draft, and say so. */
  async publish(id: string): Promise<{ id: string }> {
    await this.published({ id, title: `post ${id}`, at: new Date() });
    return { id };
  }
}
