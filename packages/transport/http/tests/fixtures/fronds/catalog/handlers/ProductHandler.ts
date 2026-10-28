import { FougereError, ErrorCode, type Repository } from '@fougere/core';
import type Product from '../entities/Product.js';

/** Handler fixture — enough surface to prove parity, deliberate failure included. */
export default class ProductHandler {
  constructor(private products: Repository<Product>) {}

  async list() { return this.products.list(); }
  async findById(id: string) { return this.products.findById(id); }
  async create(input: Product) { return this.products.create(input); }

  async reserve(): Promise<never> {
    throw new FougereError({
      code: ErrorCode.CONFLICT,
      message: 'stock déjà réservé',
      details: { reason: 'held' },
    });
  }
}
