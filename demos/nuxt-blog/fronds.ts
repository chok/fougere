/**
 * What this app hosts.
 *
 * A list of classes, because a class already says what it is: `Crud(Post)` declares its
 * five operations, `Presenter(Post)` keeps the entity it enriches, a computed field IS a
 * method. What is named here is only what TypeScript erases — a constructor's parameter
 * types (`deps`), and the surface a handler answers on, which the scan read from its
 * directory.
 */
import { frond } from '@fougere/core';
import Author from '@fronds/blog/entities/Author.js';
import Category from '@fronds/blog/entities/Category.js';
import Post from '@fronds/blog/entities/Post.js';
import AuthorHandler from '@fronds/blog/handlers/AuthorHandler.js';
import CategoryHandler from '@fronds/blog/handlers/CategoryHandler.js';
import PostHandler from '@fronds/blog/handlers/PostHandler.js';
import PublicAuthorHandler from '@fronds/blog/handlers/public/AuthorHandler.js';
import PublicPostHandler from '@fronds/blog/handlers/public/PostHandler.js';
import PostPresenter from '@fronds/blog/presenters/PostPresenter.js';
import CurrentUserCollector from '@fronds/blog/collectors/CurrentUserCollector.js';
import User from '@fronds/user/entities/User.js';

export default [
  frond('blog', {
    entities: [Author, Category, Post],
    handlers: [
      AuthorHandler,
      CategoryHandler,
      PostHandler,
      { ctor: PublicAuthorHandler, surface: 'public' },
      { ctor: PublicPostHandler, surface: 'public' },
    ],
    presenters: [{ ctor: PostPresenter, deps: ['AuthorRepository'] }],
    collectors: [CurrentUserCollector],
  }),
  frond('user', { entities: [User] }),
];
