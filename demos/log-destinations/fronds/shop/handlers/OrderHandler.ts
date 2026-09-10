import { Crud, type Emit, type RepositoryOf } from '@fougere/core';
import type { LogLine } from '@fougere/log';
import Order from '../entities/Order.js';

/**
 * The domain, and the only line it writes about itself.
 *
 * `Emit<LogLine>` names a SUBJECT and no destination. Where the line goes is decided in
 * `main.ts`, and nothing here changes if it goes somewhere else.
 */
export default class OrderHandler extends Crud(Order) {
  constructor(repo: RepositoryOf<Order>, private log: Emit<LogLine>) {
    super(repo);
  }

  /** Place an order. */
  async create(input: Order): Promise<Order> {
    const row = await this.storage.create(input);
    await this.log({ level: 'info', name: 'shop', message: `order ${row.id} for ${row.sku}` });

    return row;
  }
}
