import type { Repository } from '@fougere/core';
import type Product from '../entities/Product.js';
import { entity, primary, text } from '@fougere/schema';

/** Schema stubs for testing AST inference. */
export class SearchInput extends entity({
  name: text(),
}) {}

export class SearchOutput extends entity({
  id: primary(),
  name: text(),
}) {}

/** Handler fixture — read-only + search op. */
export default class ProductHandler {
  constructor(private products: Repository<Product>) {}

  async list() { return this.products.list(); }
  async findById(id: string) { return this.products.findById(id); }

  /** Find products by name. Matches on a prefix, never on the description. */
  async search(input: SearchInput): Promise<SearchOutput[]> {
    return this.products.list();
  }
}
