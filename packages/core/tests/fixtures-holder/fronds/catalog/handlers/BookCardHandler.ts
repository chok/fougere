import type { RepositoryOf } from '../../../../../src/index.js';
import type BookCard from '../entities/BookCard.js';

/** The door asks for the repository, like every door. */
export default class BookCardHandler {
  constructor(private cards: RepositoryOf<BookCard>) {}

  async list() { return this.cards.list(); }
}
