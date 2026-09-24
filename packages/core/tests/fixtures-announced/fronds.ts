import { frond } from '../../src/index.js';
import { fact, op, param, pipe } from '../contract.js';
import PostPublished from './fronds/blog/entities/PostPublished.js';
import ArchiveHandler from './fronds/blog/handlers/ArchiveHandler.js';
import PostHandler from './fronds/blog/handlers/PostHandler.js';
import IndexHandler from './fronds/index/handlers/IndexHandler.js';
import HashHandler from './fronds/privacy/handlers/HashHandler.js';

export default [
  frond('blog', {
    entities: [PostPublished],
    handlers: [
      { ctor: ArchiveHandler, operations: { keep: op({ args: [fact('fact', 'postPublished')], cardinality: 'none', description: 'Keep what went out.' }) } },
      {
        ctor: PostHandler,
        deps: ['postPublishedEmit'],
        operations: { publish: op({ args: [param('id')], cardinality: 'one', description: 'Publish a draft, and say so.' }) },
      },
    ],
  }),
  frond('index', {
    handlers: [{ ctor: IndexHandler, operations: { reindex: op({ args: [fact('fact', 'postPublished')], cardinality: 'none', description: 'Re-index what was published.' }) } }],
  }),
  frond('privacy', {
    handlers: [{
      ctor: HashHandler,
      operations: {
        set: op({ args: [pipe('fact', 'postPublished')], cardinality: 'one', description: 'Replace the title with what a reader may know of it.' }),
      },
    }],
  }),
];
