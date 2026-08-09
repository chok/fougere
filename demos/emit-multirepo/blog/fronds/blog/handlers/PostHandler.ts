import type { Emit } from '@fougere/core';
import type PostPublished from '../entities/PostPublished.js';

/** Identical to the single-repo demo. This file never changes across topologies. */
export default class PostHandler {
  constructor(private published: Emit<PostPublished>) {}

  /** Publish a draft, and say so. */
  async publish(id: string, title: string): Promise<{ id: string; status: string }> {
    await this.published({ id, title, at: new Date() });
    return { id, status: 'published' };
  }
}
