import { frond } from '@fougere/core';
import Book from './fronds/library/entities/Book.ts';
import BookHandler from './fronds/library/handlers/BookHandler.ts';
import BookPresenter from './fronds/library/presenters/BookPresenter.ts';

export default [
  frond('library', {
    entities: [Book],
    handlers: [BookHandler],
    presenters: [BookPresenter],
  }),
];
