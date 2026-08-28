import Order from '../entities/Order.js';

declare class OrderRepository {
  list(): Order[];
}

export default class OrderHandler {
  constructor(private orders: OrderRepository) {}

  /** Every order this shop holds. */
  async list(): Promise<Order[]> {
    return this.orders.list();
  }
}
