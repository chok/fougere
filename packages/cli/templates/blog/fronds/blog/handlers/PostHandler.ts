import { Crud, FougereError, ErrorCode } from '@fougere/core';
import Post from '../entities/Post.js';

// An Output contract — a read projection of the entity, declared once.
// The Input contract needs no class here: it is the entity's own input
// projection ('status' is readOnly), which useFormFor(Post) renders.
export class PostCard extends Post.pick('id', 'title', 'status') {}

// Crud(Post) gives list/create/update/delete for free — the accelerator.
// 'publish' is the real business contract: a state transition that validates
// before it realises. The golden path.
export default class PostHandler extends Crud(Post) {
  /**
   * The draft→published transition. Validate: exists, draft only.
   * Realise: the server flips the owned field.
   */
  async publish(id: Post['id']): Promise<Post> {
    const post = await super.findById(id);
    if (!post) {
      throw new FougereError({ code: ErrorCode.NOT_FOUND, message: `Post '${id}' not found` });
    }
    if (post.status === 'published') {
      throw new FougereError({ code: ErrorCode.CONFLICT, message: 'Already published' });
    }

    return super.update(id, { status: 'published' });
  }

  /** Only published posts exist for the outside world, projected to the card. */
  async listPublished(): Promise<PostCard[]> {
    const { items: posts } = await super.list({ where: { status: 'published' } });

    return posts.map(({ id, title, status }) => ({ id, title, status }));
  }
}
