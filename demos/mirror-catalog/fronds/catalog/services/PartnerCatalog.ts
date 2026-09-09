import { Mirror, type Refreshed, type Storage } from '@fougere/core';
import BookCard from '../entities/BookCard.js';
import PartnerApi from './PartnerApi.js';

/**
 * The two things a mirror's author supplies: where the pages come from, and where the
 * mark lives. The mark is ours because only we know what the partner compares `?since=`
 * against — its own clock, which it never puts on a row.
 *
 * A generator, because a source that has to be copied is a source that paginates —
 * yielding a page is the shape `upsertAll` already has.
 */
export default class PartnerCatalog extends Mirror(BookCard) {
  private mark?: Date;

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

  /**
   * From when the pass STARTED, and only once it finished: a throw skips the assignment,
   * so what the partner changed during a half-written pass is asked for again.
   */
  async catchUp(): Promise<Refreshed> {
    const startedAt = new Date();
    const done = await this.refresh(this.mark);
    this.mark = startedAt;

    return done;
  }
}
