import type { Emit } from '@fougere/core';
import type PostPublished from '../entities/PostPublished.js';

/**
 * The frond that owns publication.
 *
 * It names a SUBJECT, never a recipient. There is no list of interested parties here, and
 * adding a fourth listener will not reopen this file.
 */
export default class PostHandler {
  constructor(private published: Emit<PostPublished>) {}

  /** Publish a draft, and say so. */
  async publish(id: string, title: string): Promise<{ id: string; status: string }> {
    await this.published({ id, title, at: new Date() });
    return { id, status: 'published' };
  }
}
