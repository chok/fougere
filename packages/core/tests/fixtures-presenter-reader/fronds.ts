import { frond, type FrondDescriptor } from '../../src/index.js';
import { op, typed } from '../contract.js';
import CurrentUserCollector from './fronds/listes/collectors/CurrentUserCollector.js';
import List from './fronds/listes/entities/List.js';
import User from './fronds/listes/entities/User.js';
import ListHandler from './fronds/listes/handlers/ListHandler.js';
import ListPresenter from './fronds/listes/presenters/ListPresenter.js';

const listes = frond('listes', {
  entities: [List, User],
  collectors: [CurrentUserCollector],
  presenters: [ListPresenter],
  handlers: [{ ctor: ListHandler, deps: ['ListRepository'], operations: { list: op({ output: List, cardinality: 'many' }) } }],
});

/** What a computed field takes after the rows is what the scan reads off its signature; `frond()` takes none, so the descriptor carries it. */
export default [{
  ...listes,
  presenters: listes.presenters.map((presenter) => ({
    ...presenter,
    fieldMeta: [
      { name: 'canEdit', returnType: 'boolean', params: [typed('user', 'User', { optional: true })] },
      { name: 'tags', returnType: 'string', list: true },
    ],
  })),
}] satisfies FrondDescriptor[];
