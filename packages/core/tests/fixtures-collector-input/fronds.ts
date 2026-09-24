import { frond } from '../../src/index.js';
import { op, typed } from '../contract.js';
import CurrentUserCollector from './fronds/blog/collectors/CurrentUserCollector.js';
import Post from './fronds/blog/entities/Post.js';
import User from './fronds/blog/entities/User.js';
import PostHandler from './fronds/blog/handlers/PostHandler.js';

export default [
  frond('blog', {
    entities: [Post, User],
    collectors: [CurrentUserCollector],
    handlers: [{
      ctor: PostHandler,
      operations: {
        bodyFirst: op({ params: [{ name: 'input', type: { raw: 'Post', name: 'Post' } }, typed('user', 'User', { optional: true })], input: Post }),
        collectorFirst: op({ params: [typed('user', 'User', { optional: true }), { name: 'input', type: { raw: 'Post', name: 'Post' } }], input: Post }),
      },
    }],
    operationsOverrides: { bodyFirst: { kind: 'command' }, collectorFirst: { kind: 'command' } },
  }),
];
