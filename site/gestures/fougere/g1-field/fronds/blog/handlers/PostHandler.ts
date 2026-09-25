import { Crud, FougereError, ErrorCode } from '@fougere/core';
import Post from '../entities/Post.js';

export default class PostHandler extends Crud(Post) {
  async publish(id: string): Promise<Post> {
    const post = await this.storage.findById(id);
    if (!post) throw new FougereError({ code: ErrorCode.NOT_FOUND, message: `Post '${id}' not found` });
    if (post.publishedAt) throw new FougereError({ code: ErrorCode.CONFLICT, message: 'Already published' });

    return this.storage.update(id, { publishedAt: new Date() });
  }
}
