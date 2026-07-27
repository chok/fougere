import { Presenter } from '@fougere/core';
import type { EntityOrm } from '@fougere/core';
import Post from '../entities/Post.js';
import Author from '../entities/Author.js';

/**
 * Typed alias — the scanner resolves DI by TYPE name ("AuthorOrm"),
 * which is the key the container uses for the Author entity's ORM.
 * The parameter carries the entity, so reads come back typed.
 */
type AuthorOrm = EntityOrm<Author>;

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
    const author = await this.authorOrm.findById(post.authorId);
    return author?.name ?? 'Anonymous';
  }
}
