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
// row shape rather than `unknown`: the real ORM is `EntityOrm<T>`, so a stand-in
// answering `unknown[]` forces every caller into a cast that says nothing.
declare class ProductOrm {
  list(): SearchOutput[];
  findById(id: string): SearchOutput | undefined;
}

/** Handler fixture — read-only + search op. */
export default class ProductHandler {
  constructor(private productOrm: ProductOrm) {}

  async list() { return this.productOrm.list(); }
  async findById(id: string) { return this.productOrm.findById(id); }

  /** Find products by name. Matches on a prefix, never on the description. */
  async search(input: SearchInput): Promise<SearchOutput[]> {
    return this.productOrm.list();
  }
}
