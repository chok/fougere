import type { Repository } from '@fougere/core';
import Order from '../entities/Order.js';

export default class OrderHandler {
  constructor(private orders: Repository<Order>) {}

  /** Every order this shop holds. */
  async list(): Promise<Order[]> {
    return this.orders.list();
  }
}
