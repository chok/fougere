import { frond } from '@fougere/core';
import Article from './fronds/press/entities/Article.js';
import ArticleHandler from './fronds/press/handlers/ArticleHandler.js';

export default [
  frond('press', {
    entities: [Article],
    handlers: [{ ctor: ArticleHandler, operations: { ping: { params: {} } } }],
  }),
];
