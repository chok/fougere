import { Present } from '@fougere/core';
import Book from '../entities/Book.js';

export default class BookPresenter extends Present<Book> {
  spine(books: Book[]): string[] {
    return books.map((book) => book.title.toUpperCase());
  }
}
