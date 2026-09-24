import { Crud } from '@fougere/core';
import Article from '../models/Article.js';

/** A facade found under `usecases/`. */
export default class ArticleHandler extends Crud(Article) {}
