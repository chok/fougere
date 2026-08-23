import { Presenter } from '@fougere/core';
import type { RepositoryOf } from '@fougere/core';
import Post from '../entities/Post.js';
import Author from '../entities/Author.js';

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
  constructor(private authors: RepositoryOf<Author>) {
    super();
  }

  excerpt(posts: Post[]): string[] {
    return posts.map((post) => (typeof post.body === 'string' ? post.body.slice(0, 200) : ''));
  }

  /**
   * One read for the page, not one per row. A computed field is handed the whole
   * response precisely so a lookup can be done once — the row-at-a-time form made
   * twenty posts twenty queries, and nothing about the code said so.
   */
  async authorName(posts: Post[]): Promise<string[]> {
    const ids = [...new Set(posts.map((p) => p.authorId).filter(Boolean))] as string[];
    const authors = await Promise.all(ids.map((id) => this.authors.findById(id)));
    const byId = new Map(authors.filter(Boolean).map((a) => [a!.id, a!.name]));

    return posts.map((post) => (post.authorId && byId.get(post.authorId)) || 'Anonymous');
  }
}
