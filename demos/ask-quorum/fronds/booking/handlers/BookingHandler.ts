import type { Emit } from '@fougere/core';
import type CanBook from '../entities/CanBook.js';
import type Verdict from '../entities/Verdict.js';

/**
 * It announces a SUBJECT and waits for everyone. The second type is the whole difference:
 * `Emit<CanBook>` would hand the question over and return nothing.
 *
 * It names no subscriber, holds no list, and would run unchanged with three or none.
 */
export default class BookingHandler {
  constructor(private mayBook: Emit<CanBook, Verdict>) {}

  /** Reserve a room, if nobody objects. */
  async reserve(room: string): Promise<{ room: string; booked: boolean; said: string[] }> {
    const verdicts = await this.mayBook({ room });
    const said = verdicts.map((one) => `${one.from}: ${one.ok ? 'yes' : `no — ${one.because}`}`);

    // The law is the ANNOUNCER's, and it is written here rather than in the framework:
    // this one wants unanimity. Another would take a majority, or the first refusal.
    return { room, booked: verdicts.length > 0 && verdicts.every((one) => one.ok), said };
  }
}
