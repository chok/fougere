import type { Fact } from '@fougere/core';
import type PostPublished from '../../blog/entities/PostPublished.js';

/**
 * Another frond, owning no row at all — and subscribing to nothing.
 *
 * There is no registration, no topic, no listener list. Accepting a `Fact<PostPublished>`
 * IS the subscription: the scan reads this signature and that is the whole mechanism.
 *
 * `Fact<T>` is also a promise about this method — replayable, nobody reads what it returns,
 * its failures are its own. Push is the strict mode; an op written for it is correct when
 * called directly too.
 */
export default class IndexHandler {
  /** Re-index a post that has just been published. */
  async reindex(fact: Fact<PostPublished>): Promise<void> {
    console.log(
      `\x1b[36m  [search · pid ${process.pid}]\x1b[0m indexed \x1b[1m${fact.id}\x1b[0m — "${fact.title}"`,
    );
  }
}
