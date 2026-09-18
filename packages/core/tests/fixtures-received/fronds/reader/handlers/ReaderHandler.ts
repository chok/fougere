import type { Facade } from '@fougere/core';
import type EntryHandler from '../../journal/handlers/EntryHandler.js';

/** A caller reads what the facade hands over, and says what it got. */
export default class ReaderHandler {
  constructor(private entryFacade: Facade<EntryHandler>) {}

  /** Is the stamp a `Date` on this side too? */
  async findStamp(): Promise<{ date: boolean; text: string }> {
    const entry = await this.entryFacade.findLast() as { at: unknown };

    return { date: entry.at instanceof Date, text: Object.prototype.toString.call(entry.at) };
  }
}
