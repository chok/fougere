import { frond } from '../../src/index.js';
import { op, typed } from '../contract.js';
import Post from './fronds/blog/entities/Post.js';
import PostHandler from './fronds/blog/handlers/PostHandler.js';
import CurrentUserCollector from './fronds/identity/collectors/CurrentUserCollector.js';
import User from './fronds/identity/entities/User.js';

export const identity = frond('identity', { entities: [User], collectors: [CurrentUserCollector] });

export default [
  frond('blog', {
    entities: [Post],
    handlers: [{
      ctor: PostHandler,
      operations: {
        whoExplicit: op({
          params: [typed('user', 'User', { optional: true })],
          cardinality: 'none',
          description: 'The explicit spelling of absence, needed when a required parameter follows.',
        }),
        whoOptional: op({
          params: [typed('user', 'User', { optional: true })],
          cardinality: 'none',
          description: 'The concise spelling of the same type.',
        }),
      },
    }],
  }),
  identity,
];
