import type { Logger } from '@fougere/core';

export default class ProductService {
  constructor(private logger: Logger) {}

  listProducts() {
    this.logger.info('listing products');
    return [
      { id: '1', name: 'Fougère royale', price: 24.90 },
      { id: '2', name: 'Asplenium nidus', price: 19.90 },
    ];
  }
}
