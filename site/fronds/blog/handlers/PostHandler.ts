import { Crud, FougereError, ErrorCode } from '@fougere/core';
import type { EntityOrm } from '@fougere/core';
import Post from '../entities/Post.js';
import User from '@frond/user/entities/User.js';

/** What an author may write — the io axes already exclude the server-owned fields. */
export class PostDraft extends Post.pick('slug', 'title', 'summary', 'body') {}
/** Input of the public by-slug read. */
export class BySlugInput extends Post.pick('slug') {}
/** Public card — what the blog index shows, no body. */
export class PostCard extends Post.pick('id', 'slug', 'title', 'summary', 'authorName', 'publishedAt') {}

// Judges live at module level on purpose: only PUBLIC class methods become
// operations, so a helper out here cannot become one by accident.

function requireUser(user: User | null, operation: string): User {
  if (!user) {
    throw new FougereError({ code: ErrorCode.UNAUTHORIZED, message: 'Sign in to write', entity: 'post', operation });
  }
  return user;
}

async function requireOwn(orm: EntityOrm<Post>, id: string, author: User, operation: string): Promise<Post> {
  const post = await orm.findById(id);
  if (!post) {
    throw new FougereError({ code: ErrorCode.NOT_FOUND, message: `Post '${id}' not found`, entity: 'post', operation });
  }
  if (post.authorId !== author.id) {
    throw new FougereError({ code: ErrorCode.FORBIDDEN, message: 'Only the author can do that', entity: 'post', operation });
  }
  return post;
}

async function requireFreeSlug(orm: EntityOrm<Post>, slug: string, ownId: string | undefined, operation: string): Promise<void> {
  const all = await orm.list();
  if (all.some((p) => p.slug === slug && p.id !== ownId)) {
    throw new FougereError({ code: ErrorCode.CONFLICT, message: `Slug '${slug}' is already taken`, entity: 'post', operation });
  }
}

export default class PostHandler extends Crud(Post, { list: PostCard }) {
  /** Public reading: published only, newest first, card shape — no body on the index. */
  async list(): Promise<PostCard[]> {
    const all = await this.orm.list();
    return all
      .filter((p) => p.status === 'published')
      .sort((a, b) => String(b.publishedAt).localeCompare(String(a.publishedAt)))
      .map(({ id, slug, title, summary, authorName, publishedAt }) =>
        ({ id, slug, title, summary, authorName, publishedAt }));
  }

  /** Public reading: one published post, full body, designated by slug. */
  async bySlug(input: BySlugInput): Promise<Post> {
    const all = await this.orm.list();
    const post = all.find((p) => p.slug === input.slug && p.status === 'published');
    if (!post) {
      throw new FougereError({ code: ErrorCode.NOT_FOUND, message: `No published post at '${input.slug}'`, entity: 'post', operation: 'bySlug' });
    }
    return post;
  }

  /** A post is visible when published, or when it's the author's own. */
  async findById(id: string, user: User | null): Promise<Post | undefined> {
    const post = await this.orm.findById(id);
    if (!post) return undefined;
    const own = user && post.authorId === user.id;
    return post.status === 'published' || own ? post : undefined;
  }

  /** The author's workbench: own posts, drafts first, newest first. */
  async mine(user: User | null): Promise<Post[]> {
    if (!user) return [];
    const all = await this.orm.list();
    return all
      .filter((p) => p.authorId === user.id)
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
      .sort((a, b) => (a.status === 'draft' ? 0 : 1) - (b.status === 'draft' ? 0 : 1));
  }

  /** Judge: signed-in author, free slug. Realize: stamp the author pair. */
  async create(input: PostDraft, user: User | null): Promise<Post> {
    const author = requireUser(user, 'create');
    await requireFreeSlug(this.orm, input.slug, undefined, 'create');
    return this.orm.create({
      ...input,
      authorId: author.id,
      authorName: author.name ?? author.email,
    });
  }

  /** Judge: the author only, free slug if it changes. */
  async update(id: string, input: PostDraft, user: User | null): Promise<Post> {
    const author = requireUser(user, 'update');
    const post = await requireOwn(this.orm, id, author, 'update');
    if (input.slug && input.slug !== post.slug) await requireFreeSlug(this.orm, input.slug, id, 'update');
    return this.orm.update(id, input);
  }

  /**
   * The draft→published transition — an operation, not a field write.
   * Judge: the author, a draft, a body worth publishing. Realize: the
   * server stamps the pair.
   */
  async publish(id: string, user: User | null): Promise<Post> {
    const author = requireUser(user, 'publish');
    const post = await requireOwn(this.orm, id, author, 'publish');
    if (post.status === 'published') {
      throw new FougereError({ code: ErrorCode.CONFLICT, message: 'Already published', entity: 'post', operation: 'publish' });
    }
    if (!post.body?.trim()) {
      throw new FougereError({ code: ErrorCode.CONFLICT, message: 'Cannot publish an empty draft', entity: 'post', operation: 'publish' });
    }
    return this.orm.update(id, { status: 'published', publishedAt: new Date() });
  }

  /** Judge: the author only. */
  async delete(id: string, user: User | null): Promise<boolean> {
    const author = requireUser(user, 'delete');
    await requireOwn(this.orm, id, author, 'delete');
    return this.orm.delete(id);
  }
}
