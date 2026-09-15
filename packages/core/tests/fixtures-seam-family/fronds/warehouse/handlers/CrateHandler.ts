import type CrateRepository from '../repositories/CrateRepository.js';

/** It declares no link of its own; what wraps its rows comes from the frond above it. */
export default class CrateHandler {
  constructor(private crates: CrateRepository) {}

  /** Store one crate. */
  async add(label: string): Promise<unknown> {
    return this.crates.create({ id: label, label });
  }
}
