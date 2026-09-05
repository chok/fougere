import { Crud, FougereError, ErrorCode } from '@fougere/core';
import Post from '../entities/Post.js';
import User from '@fronds/user/entities/User.js';

export class SearchByTitleInput extends Post.pick('title') {}
export class SearchByTitleOutput extends Post.pick('id', 'title') {}

export default class PostHandler extends Crud(Post) {
  /** Public reading: only published posts exist for the outside world. */
  async list(): Promise<Post[]> {
    const all = await this.storage.list();
    return all.filter((p) => p.status === 'published');
  }

  /** A post is visible when published, or when it's the reader's own draft. */
  async findById(id: string, user?: User): Promise<Post | undefined> {
    const post = await this.storage.findById(id);
    if (!post) return undefined;
    const own = user && post.authorId === user.id;
    return post.status === 'published' || own ? post : undefined;
  }

  /**
   * The draft→published transition — an operation, not a field write.
   * Validate: author only, draft only. Realise: the server stamps the pair.
   */
  async publish(id: string, user?: User): Promise<Post> {
    if (!user) {
      throw new FougereError({ code: ErrorCode.UNAUTHORIZED, message: 'Login required to publish', entity: 'post', operation: 'publish' });
    }
    const post = await this.storage.findById(id);
    if (!post) {
      throw new FougereError({ code: ErrorCode.NOT_FOUND, message: `Post '${id}' not found`, entity: 'post', operation: 'publish' });
    }
    if (post.authorId !== user.id) {
      throw new FougereError({ code: ErrorCode.FORBIDDEN, message: 'Only the author can publish', entity: 'post', operation: 'publish' });
    }
    if (post.status === 'published') {
      throw new FougereError({ code: ErrorCode.CONFLICT, message: 'Already published', entity: 'post', operation: 'publish' });
    }
    return this.storage.update(id, { status: 'published', publishedAt: new Date() });
  }

  async searchByTitle(input: SearchByTitleInput): Promise<SearchByTitleOutput[]> {
    const all = await this.storage.list();
    return all
      .filter((p) => p.status === 'published')
      .filter((p) => p.title.toLowerCase().includes(input.title.toLowerCase()))
      .map(({ id, title }) => ({ id, title }));
  }

  /**
   * Returns posts created by the current user, or an empty list when
   * unauthenticated. `?` states that the collector may resolve no user.
   */
  async mine(user?: User): Promise<Post[]> {
    if (!user) return [];
    const all = await this.storage.list();
    return all.filter((p) => p.authorId === user.id);
  }
}
