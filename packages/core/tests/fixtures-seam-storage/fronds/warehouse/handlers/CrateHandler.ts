import type CrateRepository from '../services/CrateRepository.js';

/** A neighbour that declares no link, and whose rows go through none. */
export default class CrateHandler {
  constructor(private crates: CrateRepository) {}

  /** Store one crate. */
  async add(label: string): Promise<unknown> {
    return this.crates.create({ id: label, label });
  }
}
