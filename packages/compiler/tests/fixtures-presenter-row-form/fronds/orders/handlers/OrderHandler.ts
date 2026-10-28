import type { Repository } from '@fougere/core';
import Order from '../entities/Order.js';

/** Reads only — the presenter is the subject here. */
export default class OrderHandler {
  constructor(private orders: Repository<Order>) {}

  async list() { return this.orders.list(); }
}
