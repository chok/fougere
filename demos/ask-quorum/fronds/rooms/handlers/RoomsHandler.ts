import type { Fact } from '@fougere/core';
import type CanBook from '../../booking/entities/CanBook.js';
import type Verdict from '../../booking/entities/Verdict.js';

/** One subscriber with an opinion. Its return type IS its answer — nothing registers it. */
export default class RoomsHandler {
  async check(question: Fact<CanBook>): Promise<Verdict> {
    void question;

    return { from: 'rooms', ok: true } as Verdict;
  }
}
