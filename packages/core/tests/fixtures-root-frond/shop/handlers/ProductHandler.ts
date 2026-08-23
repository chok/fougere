// Resolved by type from the container — not imported directly.
declare class ProductRepository {
  list(): unknown[];
}

/** A handler at the root scans exactly like one under `fronds/`. */
export default class ProductHandler {
  constructor(private products: ProductRepository) {}

  async list() { return this.products.list(); }
}
