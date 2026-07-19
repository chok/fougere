export default class OrderService {
  constructor(private orderRepository: OrderRepository, private logger: Logger) {}

  findAll() {
    return [{ id: '1', status: 'pending' }];
  }
}

// These are resolved by name from the container — not imported directly
declare class OrderRepository {
  findAll(): unknown[];
}
declare class Logger {
  info(msg: string): void;
}
