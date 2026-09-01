import type { RepositoryOf } from '../../../../../src/index.js';
import type BookCard from '../entities/BookCard.js';
import type FileStorage from '../services/FileStorage.js';

/** The door asks for the repository, like every door. */
export default class BookCardHandler {
  constructor(private cards: RepositoryOf<BookCard>, private files: FileStorage) {}

  async list() { return this.cards.list(); }

  /** Find where a card's file sits. */
  async findPath(name: string) { return this.files.path(name); }
}
