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
 * Fougere applies this at the façade, so every door agrees: the envelope
 * (useQuery/invoke), the REST catch-all and GraphQL all carry the computed
 * fields. An op that names its output view is the exception — there the author
 * stated the list, and an addition they left out stays out.
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
