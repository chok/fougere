import { ErrorCode, FougereError, Repository, type Emit } from '@fougere/core';
import Post from '../entities/Post.js';
import type PostPublished from '../entities/PostPublished.js';

export default class PostHandler extends Repository<Post> {
  constructor(private published: Emit<PostPublished>) {
    super();
  }

  async publish(id: Post['id']): Promise<Post> {
    const post = await this.findById(id);
    if (!post) throw new FougereError({ code: ErrorCode.NOT_FOUND, message: 'No such post' });
    if (post.status === 'published') throw new FougereError({ code: ErrorCode.CONFLICT, message: 'Already published' });

    await this.published({ id: post.id, title: post.title });

    return this.update(id, { status: 'published' });
  }
}
