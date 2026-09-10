import { createHash } from 'node:crypto';

/** A per-day salt: the same author is the same hash today, another one tomorrow. */
export default class Salt {
  private readonly day = new Date().toISOString().slice(0, 10);

  hash(author: string): string {
    return createHash('sha256').update(`${this.day}:${author}`).digest('hex').slice(0, 12);
  }
}
