import type { Repository } from '@fougere/core';
import Crate from '../entities/Crate.js';

export default class CrateHandler {
  constructor(private crates: Repository<Crate>) {}

  /** Every crate this warehouse holds. */
  async list(): Promise<Crate[]> {
    return this.crates.list();
  }
}
