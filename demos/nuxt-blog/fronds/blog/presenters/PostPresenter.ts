import { Presenter } from '@fougere/core';
import type { EntityOrm } from '@fougere/core';
import Post from '../entities/Post.js';

/**
 * Typed alias — the scanner resolves DI by TYPE name ("AuthorOrm"),
 * which is the key the container uses for the Author entity's ORM.
 */
type AuthorOrm = EntityOrm;

/**
 * Each method on the presenter becomes a computed field added to the Post
 * sent out by the handlers. Method name = field name in the JSON output.
 *
 * Fougere wires this automatically: any handler returning a Post (or list of
 * Posts) goes through PostPresenter before serialization.
 */
export default class PostPresenter extends Presenter(Post) {
  constructor(private authorOrm: AuthorOrm) {
    super();
  }

  excerpt(post: Post): string {
    return typeof post.body === 'string' ? post.body.slice(0, 200) : '';
  }

  async authorName(post: Post): Promise<string> {
    if (!post.authorId) return 'Anonymous';
    const author = await this.authorOrm.findById(post.authorId as string);
    return (author as { name?: string } | undefined)?.name ?? 'Anonymous';
  }
}
