import { Presenter } from '@fougere/core';
import Article from '../entities/Article.js';

export default class ArticlePresenter extends Presenter(Article) {
  label(articles: { sku: string; quantity: number }[]): string[] {
    return articles.map((article) => `${article.sku} × ${article.quantity}`);
  }
}
