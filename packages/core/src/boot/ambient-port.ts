/**
 * What a call needs to know about the call it is inside, and the two ways to answer it.
 *
 * One realization reads an async context (`ambient.als.ts`), the other cannot and waits
 * its turn instead (`ambient.queue.ts`). `#ambient` in package.json picks one per runtime,
 * so a bundle for a host without async context never names `node:async_hooks`.
 */
export interface Ambient {
  /** True when this runtime has no async context, and the boot says so. */
  readonly degraded: boolean;

  /**
   * Run `fn` as the frame `key`. A frame opened inside another must not proceed.
   *
   * Measured on SQLite: a second transaction on the same connection WAITS for the first,
   * so a nested frame hangs on one engine and returns when split across two.
   */
  enterFrame<R>(key: string, fn: () => Promise<R>): Promise<R>;

  /**
   * Settle before `fact` is dispatched: a fact announced inside a frame that then rolls
   * back is a lie. Refuses when the caller's own frame can be told, waits when it cannot.
   */
  beforeAnnounce(fact: string): Promise<void>;

  /**
   * The facts already being announced up the stack, so a fact cannot cause itself.
   *
   * A CHAIN and not a depth: `A → B → D` and `A → C → D` is a diamond, perfectly legal,
   * while `A → … → A` never ends. Empty where it cannot be followed.
   *
   * Detecting this at boot was the first idea and it was wrong: `Emit<G>` is a CONSTRUCTOR
   * dependency, so it belongs to the handler and not to one of its methods. A handler that
   * subscribes to `A` in one method and emits `G` from another would have been refused for
   * a cycle it never walks.
   */
  currentChain(): readonly string[];

  /** Run `fn` with `fact` appended to the emission chain. */
  enterChain<R>(fact: string, fn: () => Promise<R>): Promise<R>;
}
