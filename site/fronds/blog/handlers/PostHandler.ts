import { FougereError, ErrorCode, Page } from '@fougere/core';
import Post from '../entities/Post.js';
import PostRepository from '../repositories/PostRepository.js';
import User from '@fronds/user/entities/User.js';
import { requireOwn, requireFreeSlug } from '../rules/post.js';

/** What an author may write — the io axes already exclude the server-owned fields. */
export class PostDraft extends Post.pick('slug', 'title', 'summary', 'body') {}
/** Input of the public by-slug read. */
export class BySlugInput extends Post.pick('slug') {}
/** Public card — what the blog index shows, no body. */
export class PostCard extends Post.pick('id', 'slug', 'title', 'summary', 'authorName', 'publishedAt') {}

/**
 * It writes every op it serves — the five included, each with its own rule — so it extends no
 * repository: what it would inherit, it redefines. It asks for the one it reads through.
 */
export default class PostHandler {
  constructor(private posts: PostRepository) {}

  /**
   * Public reading: published only, newest first. It answers the card — a view, so what leaves is
   * the card's fields and the body stays home, with no copy written here.
   */
  async list(): Promise<Page<PostCard>> {
    return Page.of(await this.posts.published());
  }

  /** Public reading: one published post, full body, designated by slug. */
  async findBySlug(input: BySlugInput): Promise<Post> {
    const post = await this.posts.publishedBySlug(input.slug);
    if (!post) {
      throw new FougereError({ code: ErrorCode.NOT_FOUND, message: `No published post at '${input.slug}'` });
    }

    return post;
  }

  /** A post is visible when published, or when it's the author's own. */
  async findById(id: Post['id'], user?: User): Promise<Post | undefined> {
    const post = await this.posts.findById(id);
    if (!post) return undefined;
    const own = user && post.authorId === user.id;

    return post.status === 'published' || own ? post : undefined;
  }

  /** The author's workbench: own posts, drafts first, newest first. */
  async mine(user?: User): Promise<Post[]> {
    if (!user) return [];
    // The repository answers newest first; sort is stable, so ordering survives the
    // draft-first pass — a presentation tiebreak, not a question for the storage.
    const own = await this.posts.ofAuthor(user.id);

    return own.sort((a, b) => (a.status === 'draft' ? 0 : 1) - (b.status === 'draft' ? 0 : 1));
  }

  /** Validate: signed-in author, free slug. Realize: stamp the author pair. */
  async create(input: PostDraft, author: User): Promise<Post> {
    await requireFreeSlug(this.posts, input.slug, undefined);

    return this.posts.create({
      ...input,
      authorId: author.id,
      authorName: author.name ?? author.email,
    });
  }

  /** Validate: the author only, free slug if it changes. */
  async update(id: Post['id'], input: PostDraft, author: User): Promise<Post> {
    const post = await requireOwn(this.posts, id, author);
    if (input.slug && input.slug !== post.slug) await requireFreeSlug(this.posts, input.slug, id);

    return this.posts.update(id, input);
  }

  /**
   * The draft→published transition.
   * Validate: the author, a draft, a body worth publishing. Realize: the
   * server stamps the pair.
   */
  async publish(id: Post['id'], author: User): Promise<Post> {
    const post = await requireOwn(this.posts, id, author);
    if (post.status === 'published') {
      throw new FougereError({ code: ErrorCode.CONFLICT, message: 'Already published' });
    }
    if (!post.body?.trim()) {
      throw new FougereError({ code: ErrorCode.CONFLICT, message: 'Cannot publish an empty draft' });
    }

    return this.posts.update(id, { status: 'published', publishedAt: new Date() });
  }

  /** Validate: the author only. */
  async delete(id: Post['id'], author: User): Promise<boolean> {
    await requireOwn(this.posts, id, author);

    return this.posts.delete(id);
  }
}
