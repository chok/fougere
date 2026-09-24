import { frond } from '../../src/index.js';
import { input, op } from '../contract.js';
import Article from './fronds/press/entities/Article.js';
import ArticleHandler, { NewArticle } from './fronds/press/handlers/ArticleHandler.js';

export default [frond('press', {
  entities: [Article],
  handlers: [{
    ctor: ArticleHandler,
    operations: {
      create: op({ args: [input()], input: NewArticle, output: Article, cardinality: 'one', description: 'Publish an article.' }),
    },
  }],
})];
