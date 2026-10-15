import { Crud } from '@fougere/core';
import Article from '../entities/Article.js';

export default class ArticleHandler extends Crud(Article) {}
