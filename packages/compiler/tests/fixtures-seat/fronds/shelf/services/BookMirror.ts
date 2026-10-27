import { Mirror } from '@fougere/core';
import Book from '../entities/Book.js';

/** A generic base in between: `Mirror<T> extends Repository<T>`, so `T` is carried up. */
export default class BookMirror extends Mirror<Book> {
  async *pull(): AsyncIterable<Partial<Book>[]> {
    yield [{ id: '1', title: 'One' }];
  }
}
