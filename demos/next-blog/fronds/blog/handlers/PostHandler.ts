import { Crud, FougereError, ErrorCode } from '@fougere/core';
import Post from '../entities/Post.js';

/**
 * Ordinary user code. It imports `@fougere/core` and its own entity, and that is
 * the whole list — there is no Next import anywhere under `fronds/`, which is the
 * point of the demo: the same handler answers the envelope, REST and GraphQL, in
 * this process or behind JSON-RPC, under Nuxt or under Next.
 */
export default class PostHandler extends Crud(Post) {
  /** Public reading: only published posts exist for the outside world. */
  async list(): Promise<Post[]> {
    const all = await this.orm.list();
    return all.filter((post) => post.status === 'published');
  }

  /** Everything, drafts included — what an author's own dashboard shows. */
  async listDrafts(): Promise<Post[]> {
    const all = await this.orm.list();
    return all.filter((post) => post.status === 'draft');
  }

  /**
   * The draft→published transition — an operation, not a field write. `status` is
   * `readOnly`, so no client can reach it through create or update; this is the one
   * door, and it states its own rules.
   */
  async publish(id: string): Promise<Post> {
    const post = await this.orm.findById(id);
    if (!post) {
      throw new FougereError({ code: ErrorCode.NOT_FOUND, message: `Post '${id}' not found`, entity: 'post', operation: 'publish' });
    }
    if (post.status === 'published') {
      throw new FougereError({ code: ErrorCode.CONFLICT, message: 'Already published', entity: 'post', operation: 'publish' });
    }
    return this.orm.update(id, { status: 'published', publishedAt: new Date() });
  }
}
