import type { Together } from '@fougere/core';
import type Ledger from '../entities/Ledger.js';
import type RateCard from '../entities/RateCard.js';
import type RateMirror from '../services/RateMirror.js';

/**
 * A provider inside a frame — the case a member list of entities alone cannot cover.
 *
 * `RateMirror` writes through `Storage<RateCard>`, so naming BOTH puts its pages under
 * the same unwind as the handler's own writes. It is rebuilt in the frame's scope, so it
 * receives the framed storage through its ordinary constructor — no locator, no second path.
 */
export default class RefreshHandler {
  constructor(private together: Together<[RateCard, Ledger], [RateMirror]>) {}

  /** Pull the rates, write the line that records the pull, and fail after both. */
  async syncAndFail(): Promise<never> {
    return this.together.run(async ([, ledger], [mirror]) => {
      await mirror.refresh();
      await ledger.create({ id: 'sync', from: 'sync', to: 'sync', amount: 1 });
      throw new Error('boom');
    });
  }

  /** The same, without the failure. */
  async sync(): Promise<{ written: number }> {
    return this.together.run(async ([, ledger], [mirror]) => {
      const { written } = await mirror.refresh();
      await ledger.create({ id: 'sync', from: 'sync', to: 'sync', amount: 1 });
      return { written };
    });
  }
}
