import { Present } from '@fougere/core';
import Article from '../entities/Article.js';

export default class ArticlePresenter extends Present<Article> {
  label(articles: { sku: string; quantity: number }[]): string[] {
    return articles.map((article) => `${article.sku} × ${article.quantity}`);
  }
}
