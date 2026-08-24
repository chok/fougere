import Order from '../entities/Order.js';

declare class OrderRepository {
  list(): Order[];
}

/** Reads only — the presenter is the subject here. */
export default class OrderHandler {
  constructor(private orders: OrderRepository) {}

  async list() { return this.orders.list(); }
}
