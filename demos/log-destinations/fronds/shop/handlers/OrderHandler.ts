import { Repository, type Emit, type LogLine } from '@fougere/core';
import Order from '../entities/Order.js';

/**
 * The domain, and the only line it writes about itself.
 *
 * `Emit<LogLine>` names a SUBJECT and no destination. Where the line goes is decided in
 * `main.ts`, and nothing here changes if it goes somewhere else.
 */
export default class OrderHandler extends Repository<Order> {
  constructor(repo: Repository<Order>, private log: Emit<LogLine>) {
    super();
  }

  /** Place an order. */
  async create(input: Order): Promise<Order> {
    const row = await super.create(input);
    await this.log({ level: 'info', name: 'shop', message: `order ${row.id} for ${row.sku}` });

    return row;
  }
}
