import { Crud, FougereError, ErrorCode } from '@fougere/core';
import Post from '../entities/Post.js';
import PostRepository from '../repositories/PostRepository.js';
import User from '@fronds/user/entities/User.js';

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

async function requireOwn(posts: PostRepository, id: string, author: User, operation: string): Promise<Post> {
  const post = await posts.findById(id);
  if (!post) {
    throw new FougereError({ code: ErrorCode.NOT_FOUND, message: `Post '${id}' not found`, entity: 'post', operation });
  }
  if (post.authorId !== author.id) {
    throw new FougereError({ code: ErrorCode.FORBIDDEN, message: 'Only the author can do that', entity: 'post', operation });
  }
  return post;
}

async function requireFreeSlug(posts: PostRepository, slug: string, ownId: string | undefined, operation: string): Promise<void> {
  const clash = await posts.bySlug(slug);
  if (clash && clash.id !== ownId) {
    throw new FougereError({ code: ErrorCode.CONFLICT, message: `Slug '${slug}' is already taken`, entity: 'post', operation });
  }
}

export default class PostHandler extends Crud(Post, { list: PostCard }) {
  // A Crud handler that declares a constructor stops getting its storage injected, so it
  // takes it and hands it to super() — the boot refuses the signature otherwise. ONE
  // dependency: a repository forwards every gesture the port has, so the five CRUD ops
  // and `published()` come out of the same object.
  constructor(private posts: PostRepository) {
    super(posts);
  }

  /** Public reading: published only, newest first, card shape — no body on the index. */
  async list(): Promise<PostCard[]> {
    const published = await this.posts.published();
    return published.map(({ id, slug, title, summary, authorName, publishedAt }) =>
      ({ id, slug, title, summary, authorName, publishedAt }));
  }

  /** Public reading: one published post, full body, designated by slug. */
  async bySlug(input: BySlugInput): Promise<Post> {
    const post = await this.posts.publishedBySlug(input.slug);
    if (!post) {
      throw new FougereError({ code: ErrorCode.NOT_FOUND, message: `No published post at '${input.slug}'`, entity: 'post', operation: 'bySlug' });
    }
    return post;
  }

  /** A post is visible when published, or when it's the author's own. */
  async findById(id: string, user: User | null): Promise<Post | undefined> {
    const post = await this.posts.findById(id);
    if (!post) return undefined;
    const own = user && post.authorId === user.id;
    return post.status === 'published' || own ? post : undefined;
  }

  /** The author's workbench: own posts, drafts first, newest first. */
  async mine(user: User | null): Promise<Post[]> {
    if (!user) return [];
    // The repository answers newest first; sort is stable, so ordering survives the
    // draft-first pass — a presentation tiebreak, not a question for the storage.
    const own = await this.posts.ofAuthor(user.id);
    return own.sort((a, b) => (a.status === 'draft' ? 0 : 1) - (b.status === 'draft' ? 0 : 1));
  }

  /** Judge: signed-in author, free slug. Realize: stamp the author pair. */
  async create(input: PostDraft, user: User | null): Promise<Post> {
    const author = requireUser(user, 'create');
    await requireFreeSlug(this.posts, input.slug, undefined, 'create');
    return this.posts.create({
      ...input,
      authorId: author.id,
      authorName: author.name ?? author.email,
    });
  }

  /** Judge: the author only, free slug if it changes. */
  async update(id: string, input: PostDraft, user: User | null): Promise<Post> {
    const author = requireUser(user, 'update');
    const post = await requireOwn(this.posts, id, author, 'update');
    if (input.slug && input.slug !== post.slug) await requireFreeSlug(this.posts, input.slug, id, 'update');
    return this.posts.update(id, input);
  }

  /**
   * The draft→published transition — an operation, not a field write.
   * Judge: the author, a draft, a body worth publishing. Realize: the
   * server stamps the pair.
   */
  async publish(id: string, user: User | null): Promise<Post> {
    const author = requireUser(user, 'publish');
    const post = await requireOwn(this.posts, id, author, 'publish');
    if (post.status === 'published') {
      throw new FougereError({ code: ErrorCode.CONFLICT, message: 'Already published', entity: 'post', operation: 'publish' });
    }
    if (!post.body?.trim()) {
      throw new FougereError({ code: ErrorCode.CONFLICT, message: 'Cannot publish an empty draft', entity: 'post', operation: 'publish' });
    }
    return this.posts.update(id, { status: 'published', publishedAt: new Date() });
  }

  /** Judge: the author only. */
  async delete(id: string, user: User | null): Promise<boolean> {
    const author = requireUser(user, 'delete');
    await requireOwn(this.posts, id, author, 'delete');
    return this.posts.delete(id);
  }
}
