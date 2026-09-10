import type { Answer } from '@fougere/core';
import type CanBook from '../../booking/entities/CanBook.js';

/** One responder. Its signature IS its subscription — nothing registers it. */
export default class RoomsHandler {
  async check(question: Answer<CanBook>): Promise<CanBook> {
    return { ...question, from: 'rooms', ok: true } as CanBook;
  }
}
