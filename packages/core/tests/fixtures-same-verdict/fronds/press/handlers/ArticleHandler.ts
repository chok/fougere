import { Crud } from '@fougere/core';
import Article from '../entities/Article.js';

/** What a client may send at creation — narrower than the entity, on purpose. */
export class NewArticle extends Article.pick('title', 'body') {}

export default class ArticleHandler extends Crud(Article) {
  /** Publish an article. */
  async create(input: NewArticle): Promise<Article> {
    return this.storage.create(input as Partial<Article>);
  }
}
