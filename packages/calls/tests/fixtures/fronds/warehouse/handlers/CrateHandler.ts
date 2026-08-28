import Crate from '../entities/Crate.js';

declare class CrateRepository {
  list(): Crate[];
}

export default class CrateHandler {
  constructor(private crates: CrateRepository) {}

  /** Every crate this warehouse holds. */
  async list(): Promise<Crate[]> {
    return this.crates.list();
  }
}
