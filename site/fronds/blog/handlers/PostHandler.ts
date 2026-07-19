import { Crud, FougereError, ErrorCode } from '@fougere/core';
import type { EntityOrm } from '@fougere/core';
import Post from '../entities/Post.js';
import User from '../../user/entities/User.js';

/** What an author may write — the io axes already exclude the server-owned fields. */
export class PostDraft extends Post.pick('slug', 'title', 'summary', 'body') {}
/** Input of the public by-slug read. */
export class BySlugInput extends Post.pick('slug') {}
/** Public card — what the blog index shows, no body. */
export class PostCard extends Post.pick('id', 'slug', 'title', 'summary', 'authorName', 'publishedAt') {}

/** Loose row shape — the ORM realizes the schema, reads come back untyped enough. */
type Row = {
  id: string;
  slug: string;
  title: string;
  summary?: string;
  body?: string;
  authorId: string;
  authorName?: string;
  createdAt?: string;
  status: 'draft' | 'published';
  publishedAt?: string;
};

type Author = { id: string; name?: string; email?: string };

// Judges live at module level on purpose: every class method is an operation
// (the parser exposes them all), helpers must not be reachable over the wire.

function requireUser(user: User | null, operation: string): Author {
  if (!user) {
    throw new FougereError({ code: ErrorCode.UNAUTHORIZED, message: 'Sign in to write', entity: 'post', operation });
  }
  return user as Author;
}

async function requireOwn(orm: EntityOrm, id: string, author: Author, operation: string): Promise<Row> {
  const post = (await orm.findById(id)) as unknown as Row | undefined;
  if (!post) {
    throw new FougereError({ code: ErrorCode.NOT_FOUND, message: `Post '${id}' not found`, entity: 'post', operation });
  }
  if (post.authorId !== author.id) {
    throw new FougereError({ code: ErrorCode.FORBIDDEN, message: 'Only the author can do that', entity: 'post', operation });
  }
  return post;
}

async function requireFreeSlug(orm: EntityOrm, slug: string, ownId: string | undefined, operation: string): Promise<void> {
  const all = (await orm.list()) as unknown as Row[];
  if (all.some((p) => p.slug === slug && p.id !== ownId)) {
    throw new FougereError({ code: ErrorCode.CONFLICT, message: `Slug '${slug}' is already taken`, entity: 'post', operation });
  }
}

export default class PostHandler extends Crud(Post) {
  /** Public reading: published only, newest first, card shape. */
  async list(): Promise<PostCard[]> {
    const all = (await this.orm.list()) as unknown as Row[];
    return all
      .filter((p) => p.status === 'published')
      .sort((a, b) => String(b.publishedAt).localeCompare(String(a.publishedAt)))
      .map(({ id, slug, title, summary, authorName, publishedAt }) =>
        ({ id, slug, title, summary, authorName, publishedAt })) as PostCard[];
  }

  /** Public reading: one published post, full body, designated by slug. */
  async bySlug(input: BySlugInput): Promise<Post> {
    const all = (await this.orm.list()) as unknown as Row[];
    const post = all.find((p) => p.slug === input.slug && p.status === 'published');
    if (!post) {
      throw new FougereError({ code: ErrorCode.NOT_FOUND, message: `No published post at '${input.slug}'`, entity: 'post', operation: 'bySlug' });
    }
    return post as unknown as Post;
  }

  /** A post is visible when published, or when it's the author's own. */
  async findById(id: string, user: User | null): Promise<Post | undefined> {
    const post = (await this.orm.findById(id)) as unknown as Row | undefined;
    if (!post) return undefined;
    const own = user && post.authorId === (user as { id: string }).id;
    return post.status === 'published' || own ? (post as unknown as Post) : undefined;
  }

  /** The author's workbench: own posts, drafts first, newest first. */
  async mine(user: User | null): Promise<Post[]> {
    if (!user) return [];
    const all = (await this.orm.list()) as unknown as Row[];
    return all
      .filter((p) => p.authorId === (user as { id: string }).id)
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
      .sort((a, b) => (a.status === 'draft' ? 0 : 1) - (b.status === 'draft' ? 0 : 1)) as unknown as Post[];
  }

  /** Judge: signed-in author, free slug. Realize: stamp the author pair. */
  async create(input: PostDraft, user: User | null): Promise<Post> {
    const author = requireUser(user, 'create');
    await requireFreeSlug(this.orm, (input as { slug: string }).slug, undefined, 'create');
    return this.orm.create({
      ...(input as Partial<Post>),
      authorId: author.id,
      authorName: author.name ?? author.email,
    } as Partial<Post>);
  }

  /** Judge: the author only, free slug if it changes. */
  async update(id: string, input: PostDraft, user: User | null): Promise<Post> {
    const author = requireUser(user, 'update');
    const post = await requireOwn(this.orm, id, author, 'update');
    const draft = input as { slug?: string };
    if (draft.slug && draft.slug !== post.slug) await requireFreeSlug(this.orm, draft.slug, id, 'update');
    return this.orm.update(id, input as Partial<Post>);
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
    return this.orm.update(id, { status: 'published', publishedAt: new Date().toISOString() } as Partial<Post>);
  }

  /** Judge: the author only. */
  async delete(id: string, user: User | null): Promise<boolean> {
    const author = requireUser(user, 'delete');
    await requireOwn(this.orm, id, author, 'delete');
    return this.orm.delete(id);
  }
}
