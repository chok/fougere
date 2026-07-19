import type { Logger } from '@fougere/core';

export default class OrderService {
  constructor(
    private orderRepository: OrderRepository,
    private logger: Logger,
  ) {}

  listOrders() {
    this.logger.info('listing orders');
    return this.orderRepository.findAll();
  }

  getOrder(id: string) {
    this.logger.info(`getting order ${id}`);
    return this.orderRepository.findById(id);
  }
}

// Resolved by container — not imported directly
declare class OrderRepository {
  findAll(): { id: string; status: string; total: number }[];
  findById(id: string): { id: string; status: string; total: number } | null;
}
