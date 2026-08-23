import { FougereError, ErrorCode } from '@fougere/core';
import type { Emit } from '@fougere/core';
import type Post from '../entities/Post.js';
import type PostDraft from '../entities/PostDraft.js';
import type PostChanged from '../entities/PostChanged.js';
import type User from '../entities/User.js';

declare class PostRepository {
  list(): Promise<Post[]>;
  findById(id: string): Promise<Post | undefined>;
  create(input: Partial<Post>): Promise<Post>;
  update(id: string, input: Partial<Post>): Promise<Post>;
}

/**
 * An ordinary handler. Nothing here knows a connection is being held open, and
 * nothing here knows there is more than one reader — which is the point: the
 * live door is a consumer of this file, never a variant of it.
 */
export default class PostHandler {
  constructor(private posts: PostRepository, private changed: Emit<PostChanged>) {}

  /**
   * What this caller may read — published posts, plus their own drafts.
   *
   * The one judge in the demo. Every terminal that shows a title got it from
   * here, whatever pushed it into asking.
   */
  async list(user?: User): Promise<Post[]> {
    const all = await this.posts.list();
    return all.filter((post) => post.status === 'published' || post.author === user?.name);
  }

  /**
   * Write a draft, and say a post changed.
   *
   * `input` is supplied by the caller; `user` is supplied by the collector. The resolved
   * binding plan, rather than their position, determines the operation's input contract.
   */
  async createDraft(input: PostDraft, user?: User): Promise<Post> {
    if (!user) throw new FougereError({ code: ErrorCode.UNAUTHORIZED, message: 'sign in to write' });
    const post = await this.posts.create({ ...input, author: user.name, status: 'draft' });
    await this.changed({ id: post.id, author: post.author, status: post.status, at: new Date() });
    return post;
  }

  /** Send it out, and say so. */
  async publish(id: string): Promise<Post> {
    const post = await this.posts.update(id, { status: 'published' });
    await this.changed({ id: post.id, author: post.author, status: post.status, at: new Date() });
    return post;
  }
}
