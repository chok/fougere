import { Crud, FougereError, ErrorCode } from '@fougere/core';
import Post from '../entities/Post.js';

/** What a client may propose when drafting — `status` is not its to write. */
export class NewPost extends Post.pick('title', 'body') {}

/** What the outside world reads in a list — the body stays home. */
export class PostCard extends Post.pick('id', 'title', 'status') {}

export default class PostHandler extends Crud(Post) {
  /**
   * Crud gives the five ops; this one narrows its contract. `readOnly` already
   * bars `status` for the whole entity — `NewPost` says what *this* op accepts.
   */
  async create(input: NewPost): Promise<Post> {
    return this.orm.create(input);
  }

  /** The draft→published transition — an operation, not a field write. */
  async publish(id: string): Promise<Post> {
    const post = await this.orm.findById(id);
    if (!post) {
      throw new FougereError({ code: ErrorCode.NOT_FOUND, message: `Post '${id}' not found`, entity: 'post', operation: 'publish' });
    }
    if (post.status === 'published') {
      throw new FougereError({ code: ErrorCode.CONFLICT, message: 'Already published', entity: 'post', operation: 'publish' });
    }
    return this.orm.update(id, { status: 'published' });
  }

  /** Only published posts, projected to the card. */
  async listPublished(): Promise<PostCard[]> {
    const posts = await this.orm.list({ where: { status: 'published' } });
    return posts.map(({ id, title, status }) => ({ id, title, status }));
  }
}
