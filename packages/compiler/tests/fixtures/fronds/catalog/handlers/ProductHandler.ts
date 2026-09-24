import { entity, primary, text } from '@fougere/schema';

/** Schema stubs for testing AST inference. */
export class SearchInput extends entity({
  name: text(),
}) {}

export class SearchOutput extends entity({
  id: primary(),
  name: text(),
}) {}

// Resolved by type from the container — not imported directly. Declared over the
// row shape rather than `unknown`: the default repository IS the port, so a stand-in
// answering `unknown[]` forces every caller into a cast that says nothing.
declare class ProductRepository {
  list(): SearchOutput[];
  findById(id: string): SearchOutput | undefined;
}

/** Handler fixture — read-only + search op. */
export default class ProductHandler {
  constructor(private products: ProductRepository) {}

  async list() { return this.products.list(); }
  async findById(id: string) { return this.products.findById(id); }

  /** Find products by name. Matches on a prefix, never on the description. */
  async search(input: SearchInput): Promise<SearchOutput[]> {
    return this.products.list();
  }
}
