import { frond } from '../../src/index.js';
import { fact, op, param, pipe } from '../contract.js';
import PostPublished from './fronds/blog/entities/PostPublished.js';
import PostHandler from './fronds/blog/handlers/PostHandler.js';
import IndexHandler from './fronds/index/handlers/IndexHandler.js';
import RedactHandler from './fronds/redact/handlers/RedactHandler.js';

export default [
  frond('blog', {
    entities: [PostPublished],
    handlers: [{
      ctor: PostHandler,
      deps: ['postPublishedEmit'],
      operations: {
        publish: op({ args: [param('id')], cardinality: 'one', description: 'Publish a draft, and say so — with something a reader should not see.' }),
      },
    }],
  }),
  frond('index', {
    handlers: [{ ctor: IndexHandler, operations: { reindex: op({ args: [fact('fact', 'postPublished')], cardinality: 'none', description: 'Re-index what was published.' }) } }],
  }),
  frond('redact', {
    handlers: [{ ctor: RedactHandler, operations: { set: op({ args: [pipe('fact', 'postPublished')], cardinality: 'one', description: 'Set the address aside before anyone sees it.' }) } }],
  }),
];
