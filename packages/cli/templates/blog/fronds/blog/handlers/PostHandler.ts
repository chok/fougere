import { Crud, FougereError, ErrorCode } from '@fougere/core';
import Post from '../entities/Post.js';

// An Output contract — a read projection of the entity, declared once.
// The Input contract needs no class here: it is the entity's own input
// projection ('status' is readOnly), which useFormFor(Post) renders.
export class PostCard extends Post.pick('id', 'title', 'status') {}

// Crud(Post) gives list/create/update/delete for free — the accelerator.
// 'publish' is the real business contract: a state transition that judges
// before it realises — an operation, not a field write. The golden path.
export default class PostHandler extends Crud(Post) {
  /**
   * The draft→published transition. Judge: exists, draft only.
   * Realise: the server flips the owned field.
   */
  async publish(id: string): Promise<Post> {
    const post = await this.storage.findById(id);
    if (!post) {
      throw new FougereError({ code: ErrorCode.NOT_FOUND, message: `Post '${id}' not found`, entity: 'post', operation: 'publish' });
    }
    if (post.status === 'published') {
      throw new FougereError({ code: ErrorCode.CONFLICT, message: 'Already published', entity: 'post', operation: 'publish' });
    }
    return this.storage.update(id, { status: 'published' });
  }

  /** Only published posts exist for the outside world, projected to the card. */
  async listPublished(): Promise<PostCard[]> {
    const posts = await this.storage.list({ where: { status: 'published' } });
    return posts.map(({ id, title, status }) => ({ id, title, status }));
  }
}
