import { frond } from '../../src/index.js';
import { op, param } from '../contract.js';
import BookCard from './fronds/catalog/entities/BookCard.js';
import BookCardHandler from './fronds/catalog/handlers/BookCardHandler.js';
import FileStorage from './fronds/catalog/services/FileStorage.js';
import PartnerCatalog from './fronds/catalog/services/PartnerCatalog.js';

export default [frond('catalog', {
  entities: [BookCard],
  providers: [FileStorage, { ctor: PartnerCatalog, deps: ['BookCardStorage'] }],
  handlers: [{
    ctor: BookCardHandler,
    deps: ['BookCardRepository', 'FileStorage'],
    operations: {
      list: op({ output: BookCard, cardinality: 'page' }),
      findPath: op({ args: [param('name')], cardinality: 'none', description: "Find where a card's file sits." }),
    },
  }],
})];
