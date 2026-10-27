import { Repository } from '@fougere/core';
import Article from '../entities/Article.js';

/** What a client may send at creation — narrower than the entity, on purpose. */
export class NewArticle extends Article.pick('title', 'body') {}

export default class ArticleHandler extends Repository<Article> {
  /** Publish an article. */
  async create(input: NewArticle): Promise<Article> {
    return super.create(input as Partial<Article>);
  }
}
