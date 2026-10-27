import { Repository } from '@fougere/core';
import Post from '../entities/Post.js';

/** A handler IS the repository of its entity: it serves the five, and what it writes on top. */
export default class PostHandler extends Repository<Post> {
  /** Publish a draft. */
  async publish(id: Post['id']): Promise<Post> {
    return this.update(id, { status: 'published' });
  }
}
