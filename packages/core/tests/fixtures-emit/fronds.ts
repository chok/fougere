import { frond } from '../../src/index.js';
import { fact, op, param } from '../contract.js';
import Post from './fronds/blog/entities/Post.js';
import PostPublished from './fronds/blog/entities/PostPublished.js';
import PostHandler from './fronds/blog/handlers/PostHandler.js';
import DigestHandler from './fronds/mail/handlers/DigestHandler.js';
import IndexHandler from './fronds/search/handlers/IndexHandler.js';

export const blog = frond('blog', {
  entities: [Post, PostPublished],
  handlers: [{
    ctor: PostHandler,
    deps: ['postPublishedEmit'],
    operations: { publish: op({ args: [param('id')], cardinality: 'one', description: 'Publish a draft, and say so.' }) },
  }],
});

export default [
  blog,
  frond('mail', {
    handlers: [{ ctor: DigestHandler, operations: { queue: op({ args: [fact('fact', 'postPublished')], cardinality: 'none', description: 'Queue a digest entry, badly.' }) } }],
  }),
  frond('search', {
    handlers: [{ ctor: IndexHandler, operations: { reindex: op({ args: [fact('fact', 'postPublished')], cardinality: 'none', description: 'Re-index a post that has just been published.' }) } }],
  }),
];
