import { ErrorCode, FougereError, Repository } from '@fougere/core';
import Post from '../entities/Post.js';

export default class PostHandler extends Repository<Post> {
  async publish(id: Post['id']): Promise<Post> {
    const post = await this.findById(id);
    if (!post) throw new FougereError({ code: ErrorCode.NOT_FOUND, message: 'No such post' });
    if (post.status === 'published') throw new FougereError({ code: ErrorCode.CONFLICT, message: 'Already published' });

    return this.update(id, { status: 'published' });
  }
}
