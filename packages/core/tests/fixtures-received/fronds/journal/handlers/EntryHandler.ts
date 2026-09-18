import Entry from '../entities/Entry.js';

/** The frond that owns the rows. It answers a `Date`, as its entity declares. */
export default class EntryHandler {
  /** The last entry written. */
  async findLast(): Promise<Entry> {
    return { id: 'e1', label: 'first', at: new Date(0) } as Entry;
  }
}
