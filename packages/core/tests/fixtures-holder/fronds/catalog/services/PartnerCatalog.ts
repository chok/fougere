import { Mirror } from '../../../../../src/index.js';
import type { Storage } from '../../../../../src/index.js';
import BookCard from '../entities/BookCard.js';

/**
 * A holder, not a door: it OWNS the copy it writes, so naming the port is what its
 * prefab was built for. The rule that bans the port elsewhere lets this line stand.
 */
export default class PartnerCatalog extends Mirror(BookCard) {
  constructor(storage: Storage<BookCard>) { super(storage); }

  async *pull() { yield [{ isbn: '1', title: 'a' }]; }
}
