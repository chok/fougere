import type { Emit, Fact } from '@fougere/core';
import type { Alpha, Beta } from '../../alpha/handlers/AlphaHandler.js';

/** Hears beta, announces alpha — and the ring closes here. */
export default class BetaHandler {
  constructor(private alpha: Emit<Alpha>) {}

  /**
   * React to beta by announcing alpha.
   *
   * The refusal reaches THIS code, not the frond that started the chain: whoever closes
   * the ring is the one who learns. Recorded rather than rethrown so the test can read it.
   */
  async onBeta(fact: Fact<Beta>): Promise<void> {
    try {
      await this.alpha({ id: fact.id });
    } catch (cause) {
      ((globalThis as any).__heard ??= []).push(`refused:${(cause as Error).message}`);
    }
  }
}
