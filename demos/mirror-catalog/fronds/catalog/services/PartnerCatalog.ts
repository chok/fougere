import { Mirror, type Storage } from '@fougere/core';
import BookCard from '../entities/BookCard.js';
import PartnerApi from './PartnerApi.js';

/**
 * The one thing a mirror's author supplies: where the pages come from.
 *
 * A generator, because a source that has to be copied is a source that paginates —
 * yielding a page is the shape `upsertAll` already has.
 */
export default class PartnerCatalog extends Mirror(BookCard) {
  constructor(storage: Storage<BookCard>, private partner: PartnerApi) {
    super(storage);
  }

  async *pull(since?: Date): AsyncIterable<Partial<BookCard>[]> {
    for (let page: number | null = 0; page !== null; ) {
      const { items, next } = await this.partner.page(page, since);
      yield items as Partial<BookCard>[];
      page = next;
    }
  }
}
