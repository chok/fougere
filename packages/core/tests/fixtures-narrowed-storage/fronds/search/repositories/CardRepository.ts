import { Repository } from '../../../../../src/index.js';
import Card from '../entities/Card.js';
import type { RankedStorage } from '../storage.js';

/** The constructor names the realization; the key it asks for is still `Card`'s storage. */
export default class CardRepository extends Repository(Card) {
  constructor(private index: RankedStorage<Card>) {
    super(index);
  }

  ranked(query: string) {
    return this.index.search(query);
  }
}
