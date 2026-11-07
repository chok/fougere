import { ErrorCode, FougereError, type Facade, type Repository } from '@fougere/core';
import type ProductHandler from '@shop/catalog/endpoints/ProductHandler.js';
import type Order from '@shop/orders/models/Order.js';
import type Till from '@shop/orders/providers/Till.js';

export default class OrderHandler {
  constructor(
    private orders: Repository<Order>,
    private products: Facade<ProductHandler>,
    private till: Till,
  ) {}

  async place(productId: string): Promise<Order> {
    const product = await this.products.findById(productId);
    if (!product) throw new FougereError({ code: ErrorCode.NOT_FOUND, message: `No product '${productId}'` });

    return this.orders.create({ product: product.title, cents: this.till.total(product.cents) });
  }
}
