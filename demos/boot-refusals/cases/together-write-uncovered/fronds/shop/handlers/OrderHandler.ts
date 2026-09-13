import type { Together } from '@fougere/core';
import type Item from '../entities/Item.js';
import type LineRepository from '../repositories/LineRepository.js';

/** The frame names Item, and rebuilds a repository that writes Line. */
export default class OrderHandler {
  constructor(private together: Together<[Item], [LineRepository]>) {}

  /** Open an order. */
  async open(): Promise<{ ok: true }> {
    return this.together.run(async () => ({ ok: true as const }));
  }
}
