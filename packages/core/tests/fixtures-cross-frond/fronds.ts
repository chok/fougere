import { frond } from '../../src/index.js';
import { op } from '../contract.js';
import Commande from './fronds/commande/entities/Commande.js';
import CommandeHandler from './fronds/commande/handlers/CommandeHandler.js';
import Article from './fronds/stock/entities/Article.js';
import ArticleHandler from './fronds/stock/handlers/ArticleHandler.js';

export const commande = frond('commande', {
  entities: [Commande],
  handlers: [{
    ctor: CommandeHandler,
    deps: ['articleHandler'],
    operations: { servable: op({ cardinality: 'none', description: 'Can this order be served from the shelf?' }) },
  }],
  operationsOverrides: { servable: { kind: 'query' } },
});

export const stock = frond('stock', {
  entities: [Article],
  handlers: [{
    ctor: ArticleHandler,
    operations: { onHand: op({ cardinality: 'none', description: 'How many of this article are on the shelf.' }) },
  }],
  operationsOverrides: { onHand: { kind: 'query' } },
});

export default [commande, stock];
