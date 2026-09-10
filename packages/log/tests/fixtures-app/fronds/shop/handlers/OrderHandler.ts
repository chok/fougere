import type { Emit, LogLine } from '@fougere/core';

/** What a frond writes when it wants a line kept: it names a subject, never a destination. */
export default class OrderHandler {
  constructor(private log: Emit<LogLine>) {}

  /** Create an order, and say so. */
  async create(id: string): Promise<{ id: string }> {
    await this.log({ level: 'info', name: 'shop', message: `order ${id} created`, args: [] });

    return { id };
  }
}
