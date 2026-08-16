import { Repository } from '@fougere/core';
import Post from '../entities/Post.js';

/**
 * The questions the blog asks of its posts.
 *
 * Each of these was `orm.list()` followed by a filter in JavaScript, inside the
 * calculation it fed: the whole table read to answer about a handful of rows.
 */
export default class PostRepository extends Repository(Post) {
  /** The public index: published only, newest first. */
  published(): Promise<Post[]> {
    return this.orm.list({ where: { status: 'published' }, orderBy: 'publishedAt', order: 'desc' });
  }

  /** The public read: the published post carrying this slug, if there is one. */
  publishedBySlug(slug: string): Promise<Post | undefined> {
    return this.orm.findBy({ slug, status: 'published' });
  }

  /**
   * Any post carrying this slug, whatever its status — what a uniqueness check asks.
   * `slug` is not a database constraint, so this is the only thing holding it.
   */
  bySlug(slug: string): Promise<Post | undefined> {
    return this.orm.findBy({ slug });
  }

  /** The author's workbench: their own posts, newest first. */
  ofAuthor(authorId: string): Promise<Post[]> {
    return this.orm.list({ where: { authorId }, orderBy: 'createdAt', order: 'desc' });
  }
}
