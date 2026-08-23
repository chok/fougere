import { Crud } from '../../../../../src/prefab/crud.js';
import Article from '../models/Article.js';

/** A door found under `usecases/`. */
export default class ArticleHandler extends Crud(Article) {}
