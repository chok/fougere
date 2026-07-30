/** Schema-like stubs for testing AST inference. */
export class SearchInput {
  static getFields() {
    return { name: { __brand: 'fougere_field' as const, type: 'text', options: {}, nullable: false } };
  }
}

export class SearchOutput {
  static getFields() {
    return {
      id: { __brand: 'fougere_field' as const, type: 'id', options: { primary: true }, nullable: false },
      name: { __brand: 'fougere_field' as const, type: 'text', options: {}, nullable: false },
    };
  }
}

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

  async search(input: SearchInput): Promise<SearchOutput[]> {
    return this.productOrm.list();
  }
}
