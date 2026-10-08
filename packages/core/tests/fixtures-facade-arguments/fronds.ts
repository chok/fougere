import { frond } from '../../src/index.js';
import { collected, fact, input, op, param } from '../contract.js';
import Article from './fronds/stock/entities/Article.js';
import Restock from './fronds/stock/entities/Restock.js';
import User from './fronds/stock/entities/User.js';
import ArticleHandler from './fronds/stock/handlers/ArticleHandler.js';
import ArticlePresenter from './fronds/stock/presenters/ArticlePresenter.js';
import CurrentUserCollector from './fronds/stock/collectors/CurrentUserCollector.js';

export default frond('stock', {
  entities: [Article, User],
  collectors: [CurrentUserCollector],
  presenters: [ArticlePresenter],
  handlers: [{
    ctor: ArticleHandler,
    operations: {
      restock: op({
        args: [param('id'), input(), collected('user', 'user', { optional: true })],
        input: Restock,
        cardinality: 'one',
        description: 'Put stock back on the shelf, and say who did.',
      }),
      record: op({
        args: [fact('restock', 'restock')],
        input: Restock,
        cardinality: 'one',
        description: 'What a restock adds up to, read off the fact.',
      }),
    },
  }],
  operationsOverrides: { restock: { kind: 'command' } },
});
