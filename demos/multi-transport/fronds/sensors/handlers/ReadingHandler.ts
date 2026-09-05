import { FougereError, ErrorCode } from '@fougere/core';
import type Reading from '../entities/Reading.js';

declare class ReadingRepository {
  list(): Promise<Reading[]>;
  findById(id: string): Promise<Reading | undefined>;
  create(input: Partial<Reading>): Promise<Reading>;
}

/**
 * An ordinary handler. Nothing here names a protocol, a port or a broker —
 * which is the point of the demo: this file is identical whether the call
 * arrives in memory, over HTTP, or over a socket.
 */
export default class ReadingHandler {
  constructor(private readings: ReadingRepository) {}

  /** Every reading the station has sent. */
  async list() { return this.readings.list(); }

  /** One reading by id. */
  async findById(id: string) { return this.readings.findById(id); }

  /** Record a reading — validated by the façade before it lands here. */
  async create(input: Reading) { return this.readings.create(input); }

  /** A deliberate business failure, to show a typed error crossing intact. */
  async sendCalibration(): Promise<never> {
    throw new FougereError({
      code: ErrorCode.CONFLICT,
      message: 'station is mid-cycle',
      entity: 'reading',
      operation: 'sendCalibration',
      details: { retryAfterSeconds: 30 },
    });
  }
}
