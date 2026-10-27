import { Repository, FougereError, ErrorCode, Page } from '@fougere/core';
import Post from '../entities/Post.js';
import User from '@fronds/user/entities/User.js';

export class SearchByTitleInput extends Post.pick('title') {}
export class SearchByTitleOutput extends Post.pick('id', 'title') {}

/**
 * It changes what reading means — published only, a draft visible to its author — so it extends no
 * repository: what it would inherit, it redefines. It writes the five and asks for the rows.
 */
export default class PostHandler {
  constructor(private posts: Repository<Post>) {}

  /** Public reading: only published posts exist for the outside world. */
  async list(): Promise<Page<Post>> {
    const all = await this.posts.list();

    return Page.of(all.filter((p) => p.status === 'published'));
  }

  /** A post is visible when published, or when it's the reader's own draft. */
  async findById(id: Post['id'], user?: User): Promise<Post | undefined> {
    const post = await this.posts.findById(id);
    if (!post) return undefined;
    const own = user && post.authorId === user.id;

    return post.status === 'published' || own ? post : undefined;
  }

  /**
   * The draft→published transition.
   * Validate: author only, draft only. Realise: the server stamps the pair.
   */
  async publish(id: Post['id'], user: User): Promise<Post> {
    const post = await this.posts.findById(id);
    if (!post) {
      throw new FougereError({ code: ErrorCode.NOT_FOUND, message: `Post '${id}' not found` });
    }
    if (post.authorId !== user.id) {
      throw new FougereError({ code: ErrorCode.FORBIDDEN, message: 'Only the author can publish' });
    }
    if (post.status === 'published') {
      throw new FougereError({ code: ErrorCode.CONFLICT, message: 'Already published' });
    }

    return this.posts.update(id, { status: 'published', publishedAt: new Date() });
  }

  async searchByTitle(input: SearchByTitleInput): Promise<SearchByTitleOutput[]> {
    const all = await this.posts.list();

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
    const all = await this.posts.list();

    return all.filter((p) => p.authorId === user.id);
  }

  /** Write a post. */
  async create(input: Post): Promise<Post> {
    return this.posts.create(input);
  }

  /** Change a post. */
  async update(id: Post['id'], input: Partial<Post>): Promise<Post> {
    return this.posts.update(id, input);
  }

  /** Delete a post. */
  async delete(id: Post['id']): Promise<boolean> {
    return this.posts.delete(id);
  }
}
