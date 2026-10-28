import { FougereError, ErrorCode, type Repository } from '@fougere/core';
import type Reading from '../entities/Reading.js';

/**
 * An ordinary handler. Nothing here names a protocol, a port or a broker —
 * which is the point of the demo: this file is identical whether the call
 * arrives in memory, over HTTP, or over a socket.
 */
export default class ReadingHandler {
  constructor(private readings: Repository<Reading>) {}

  /** Every reading the station has sent. */
  async list() { return this.readings.list(); }

  /** One reading by id. */
  async findById(id: Reading['id']) { return this.readings.findById(id); }

  /** Record a reading — validated by the façade before it lands here. */
  async create(input: Reading) { return this.readings.create(input); }

  /** A deliberate business failure, to show a typed error crossing intact. */
  async sendCalibration(): Promise<never> {
    throw new FougereError({
      code: ErrorCode.CONFLICT,
      message: 'station is mid-cycle',
      details: { retryAfterSeconds: 30 },
    });
  }
}
