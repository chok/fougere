import { Repository } from '@fougere/core';
import Article from '../entities/Article.js';

export default class ArticleHandler extends Repository<Article> {
  /** Publish a draft. */
  async publish(id: Article['id']): Promise<Article> {
    return await this.update(id, { status: 'published' }) as Article;
  }
}
