import { Repository } from '@fougere/core';
import Book from '../entities/Book.js';

export default class BookRepository extends Repository<Book> {
  async titled(title: string): Promise<Book | undefined> {
    return this.findBy({ title });
  }
}
