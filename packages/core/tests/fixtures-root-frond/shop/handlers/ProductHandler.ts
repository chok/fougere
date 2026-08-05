// Resolved by type from the container — not imported directly.
declare class ProductOrm {
  list(): unknown[];
}

/** A handler at the root scans exactly like one under `fronds/`. */
export default class ProductHandler {
  constructor(private productOrm: ProductOrm) {}

  async list() { return this.productOrm.list(); }
}
