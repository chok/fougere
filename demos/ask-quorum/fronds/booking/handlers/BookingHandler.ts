import { Crud, type Ask, type RepositoryOf } from '@fougere/core';
import Booking from '../entities/Booking.js';
import type CanBook from '../entities/CanBook.js';

/**
 * It asks a SUBJECT and waits for everyone. It names no responder, holds no list, and
 * would run unchanged with three of them or none.
 */
export default class BookingHandler extends Crud(Booking) {
  constructor(repo: RepositoryOf<Booking>, private mayBook: Ask<CanBook>) {
    super(repo);
  }

  /** Reserve a room, if nobody objects. */
  async reserve(room: string): Promise<{ room: string; booked: boolean; said: string[] }> {
    const answers = await this.mayBook({ room });
    const said = answers.map((one) => `${one.from}: ${one.ok ? 'yes' : `no — ${one.because}`}`);

    // The law is the ASKER's, and it is written here rather than in the framework: this
    // one wants unanimity. Another would take a majority, or the first refusal.
    const booked = answers.length > 0 && answers.every((one) => one.ok);
    // And the storage asks the same question again, on its own account — see
    // `src/asking-storage.ts`. Nothing here tells it to.
    if (booked) await this.storage.create({ room });

    return { room, booked, said };
  }
}
