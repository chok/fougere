import { Crud, FougereError, ErrorCode } from '@fougere/core';
import Post from '../entities/Post.js';

export class PostCard extends Post.pick('id', 'title', 'status') {}

export default class PostHandler extends Crud(Post) {
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
