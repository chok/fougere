import { Crud, FougereError, ErrorCode } from '@fougere/core';
import Post from '../entities/Post.js';
import User from '../../user/entities/User.js';

export class SearchByTitleInput extends Post.pick('title') {}
export class SearchByTitleOutput extends Post.pick('id', 'title') {}

export default class PostHandler extends Crud(Post) {
  /** Public reading: only published posts exist for the outside world. */
  async list(): Promise<Post[]> {
    const all = await this.orm.list();
    return all.filter((p) => (p as { status?: string }).status === 'published') as Post[];
  }

  /** A post is visible when published, or when it's the reader's own draft. */
  async findById(id: string, user: User | null): Promise<Post | undefined> {
    const post = await this.orm.findById(id);
    if (!post) return undefined;
    const own = user && (post as { authorId?: string }).authorId === (user as { id: string }).id;
    return (post as { status?: string }).status === 'published' || own ? post : undefined;
  }

  /**
   * The draft→published transition — an operation, not a field write.
   * Judge: author only, draft only. Realise: the server stamps the pair.
   */
  async publish(id: string, user: User | null): Promise<Post> {
    if (!user) {
      throw new FougereError({ code: ErrorCode.UNAUTHORIZED, message: 'Login required to publish', entity: 'post', operation: 'publish' });
    }
    const post = await this.orm.findById(id);
    if (!post) {
      throw new FougereError({ code: ErrorCode.NOT_FOUND, message: `Post '${id}' not found`, entity: 'post', operation: 'publish' });
    }
    if ((post as { authorId?: string }).authorId !== (user as { id: string }).id) {
      throw new FougereError({ code: ErrorCode.FORBIDDEN, message: 'Only the author can publish', entity: 'post', operation: 'publish' });
    }
    if ((post as { status?: string }).status === 'published') {
      throw new FougereError({ code: ErrorCode.CONFLICT, message: 'Already published', entity: 'post', operation: 'publish' });
    }
    return this.orm.update(id, { status: 'published', publishedAt: new Date().toISOString() } as Partial<Post>);
  }

  async searchByTitle(input: SearchByTitleInput): Promise<SearchByTitleOutput[]> {
    const all = await this.orm.list();
    return all
      .filter((p) => (p as { status?: string }).status === 'published')
      .filter((p) => String(p.title).toLowerCase().includes(input.title.toLowerCase()))
      .map(({ id, title }) => ({ id: String(id), title: String(title) }));
  }

  /**
   * Returns posts created by the current user, or an empty list when
   * unauthenticated. `User | null` is spelled out — the signature parser
   * matches the collector on the entity type name, not through aliases.
   */
  async mine(user: User | null): Promise<Post[]> {
    if (!user) return [];
    const all = await this.orm.list();
    return all.filter((p) => (p as { authorId?: string }).authorId === (user as { id: string }).id) as Post[];
  }
}
