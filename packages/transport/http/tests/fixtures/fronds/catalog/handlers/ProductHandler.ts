import { FougereError, ErrorCode } from '@fougere/core';
import type Product from '../entities/Product.js';

// Resolved by type from the container — not imported directly. Declared over the
// entity rather than over `Record<string, unknown>`: the real ORM is `EntityOrm<T>`,
// and an entity class is not an index signature, so a stand-in typed on records
// forces every caller into a cast that says nothing.
declare class ProductOrm {
  list(): Promise<Product[]>;
  findById(id: string): Promise<Product | undefined>;
  create(input: Partial<Product>): Promise<Product>;
}

/** Handler fixture — enough surface to prove parity, deliberate failure included. */
export default class ProductHandler {
  constructor(private productOrm: ProductOrm) {}

  async list() { return this.productOrm.list(); }
  async findById(id: string) { return this.productOrm.findById(id); }
  async create(input: Product) { return this.productOrm.create(input); }

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
