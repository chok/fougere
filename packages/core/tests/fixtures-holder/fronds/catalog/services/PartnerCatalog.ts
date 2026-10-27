import { Mirror } from '../../../../../src/index.js';
import BookCard from '../entities/BookCard.js';

/** A holder, not a facade: it OWNS the copy it writes, seated on its rows like any repository. */
export default class PartnerCatalog extends Mirror<BookCard> {

  async *pull() { yield [{ isbn: '1', title: 'a' }]; }
}
