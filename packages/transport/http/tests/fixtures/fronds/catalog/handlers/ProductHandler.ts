import { FougereError, ErrorCode } from '@fougere/core';
import type Product from '../entities/Product';

// Resolved by type from the container — not imported directly
declare class ProductOrm {
  list(): Promise<unknown[]>;
  findById(id: string): Promise<unknown>;
  create(input: Record<string, unknown>): Promise<unknown>;
}

/** Handler fixture — enough surface to prove parity, deliberate failure included. */
export default class ProductHandler {
  constructor(private productOrm: ProductOrm) {}

  async list() { return this.productOrm.list(); }
  async findById(id: string) { return this.productOrm.findById(id); }
  async create(input: Product) { return this.productOrm.create(input as Record<string, unknown>); }

  async reserve(): Promise<never> {
    throw new FougereError({
      code: ErrorCode.CONFLICT,
      message: 'stock déjà réservé',
      entity: 'product',
      operation: 'reserve',
      details: { reason: 'held' },
    });
  }
}
