import { ErrorCode, FougereError, Repository } from '@fougere/core';
import Post from '../entities/Post.js';
import Mailer from '../services/Mailer.js';

export default class PostHandler extends Repository<Post> {
  constructor(private mailer: Mailer) {
    super();
  }

  async publish(id: Post['id']): Promise<Post> {
    const post = await this.findById(id);
    if (!post) throw new FougereError({ code: ErrorCode.NOT_FOUND, message: 'No such post' });
    if (post.status === 'published') throw new FougereError({ code: ErrorCode.CONFLICT, message: 'Already published' });

    await this.mailer.send(`Published: ${post.title}`);

    return this.update(id, { status: 'published' });
  }
}
