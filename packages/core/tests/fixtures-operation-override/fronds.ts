import { frond } from '../../src/index.js';
import { input, op } from '../contract.js';
import Post from './fronds/blog/entities/Post.js';
import ArchiveHandler from './fronds/blog/handlers/ArchiveHandler.js';
import PostHandler from './fronds/blog/handlers/PostHandler.js';

export default [
  frond('blog', {
    entities: [Post],
    handlers: [
      { ctor: PostHandler, operations: { publish: op({ args: [input()], input: Post }) } },
      { ctor: ArchiveHandler, operations: { execute: op({ args: [input()], input: Post }) } },
    ],
    operationsOverrides: { publish: { kind: 'command', handlerName: 'ArchiveHandler', method: 'execute' } },
  }),
];
