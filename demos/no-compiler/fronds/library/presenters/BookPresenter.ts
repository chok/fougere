import { Present } from '@fougere/core';
import Book from '../entities/Book.ts';

export default class BookPresenter extends Present<Book> {
  async evenings(rows: { pages: number }[]): Promise<number[]> {
    return rows.map((book) => Math.ceil(book.pages / 40));
  }
}
