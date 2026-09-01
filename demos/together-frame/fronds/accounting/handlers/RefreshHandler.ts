import type { Together } from '@fougere/core';
import type Ledger from '../entities/Ledger.js';
import type RateCard from '../entities/RateCard.js';
import type RateMirror from '../services/RateMirror.js';

/**
 * A PROVIDER as a member — the case a list of entities alone cannot cover.
 *
 * `RateMirror` writes through `Storage<RateCard>`. Naming both puts its pages under the
 * same unwind as this handler's own writes: the mirror is rebuilt inside the frame's scope,
 * so it receives the framed storage through its ordinary constructor. No locator, no second
 * injection path, and not one line of `Mirror` knows a frame exists.
 *
 * An import is where the unwind earns its second query: a page is upserted, so some rows
 * are new and some replace a row that was there. Reading the keys first is what tells them
 * apart — the new ones are deleted, the replaced ones are put back as they were.
 */
export default class RefreshHandler {
  constructor(private together: Together<[RateCard, Ledger], [RateMirror]>) {}

  /** Pull the rates, record the pull, and fail after both. */
  async syncAndFail(): Promise<never> {
    return this.together.run(async ([rates, ledger], [mirror]) => {
      const { written } = await mirror.refresh();
      await ledger.create({ id: `sync-${Date.now()}`, from: 'sync', to: 'sync', amount: 0 });
      const inside = (await rates.list()).map((rate: any) => `${rate.code}=${rate.rate}`).sort().join(' ');
      throw new Error(
        `the partner closed the connection mid-import\n`
        + `           inside the block, ${written} rate(s) were written: ${inside}`,
      );
    });
  }
}
