import type CardRepository from '../repositories/CardRepository.js';
import type FileStorage from '../services/FileStorage.js';

export default class CardHandler {
  constructor(
    private cards: CardRepository,
    private files: FileStorage,
  ) {}

  /** The ranked identifiers, through the repository that owns the index. */
  async search(query: string) {
    return await this.cards.ranked(query);
  }

  /** Where the cards sit. Its dependency is a class name, not a storage key. */
  readLocation() {
    return this.files.where();
  }
}
