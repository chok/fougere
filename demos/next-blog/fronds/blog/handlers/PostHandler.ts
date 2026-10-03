import { Crud, FougereError, ErrorCode, pageOf, type Page } from '@fougere/core';
import Post from '../entities/Post.js';

/**
 * Ordinary user code. It imports `@fougere/core` and its own entity, and that is
 * the whole list — there is no Next import anywhere under `fronds/`, which is the
 * point of the demo: the same handler answers the envelope, REST and GraphQL, in
 * this process or behind JSON-RPC, under Nuxt or under Next.
 */
export default class PostHandler extends Crud(Post) {
  /** Public reading: only published posts exist for the outside world. */
  async list(): Promise<Page<Post>> {
    const { items: all } = await super.list();

    return pageOf(all.filter((post) => post.status === 'published'));
  }

  /** Everything, drafts included — what an author's own dashboard shows. */
  async listDrafts(): Promise<Post[]> {
    const { items: all } = await super.list();

    return all.filter((post) => post.status === 'draft');
  }

  /**
   * The draft→published transition. `status` is
   * `readOnly`, so no client can reach it through create or update; this is the one
   * facade, and it states its own rules.
   */
  async publish(id: Post['id']): Promise<Post> {
    const post = await super.findById(id);
    if (!post) {
      throw new FougereError({ code: ErrorCode.NOT_FOUND, message: `Post '${id}' not found` });
    }
    if (post.status === 'published') {
      throw new FougereError({ code: ErrorCode.CONFLICT, message: 'Already published' });
    }

    return super.update(id, { status: 'published', publishedAt: new Date() });
  }
}
