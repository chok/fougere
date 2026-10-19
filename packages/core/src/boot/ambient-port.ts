/** One value carried across awaits — what the code running now is inside of. */
export interface Slot<T> {
  /** The value in scope, absent outside any and where there is no async context. */
  current(): T | undefined;
  /** Run `fn` with `value` in scope. */
  within<R>(value: T, fn: () => Promise<R>): Promise<R>;
}

/**
 * What runs now, carried without being handed along — one mechanism for every package, each
 * keeping its own slot: core its operation and request, `@fougere/observability` its span.
 */
export interface Ambient {
  /** True when this runtime has no async context, and the boot says so. */
  readonly degraded: boolean;

  /** The slot named `name` — the same one each time it is asked for, so two callers share it. */
  slot<T>(name: string): Slot<T>;

  /** Run `fn` as the frame `key`. */
  enterFrame<R>(key: string, fn: () => Promise<R>): Promise<R>;

  /**
   * Settle before `fact` is dispatched: a fact announced inside a frame that then rolls
   * back is a lie. Refuses when the caller's own frame can be told, waits when it cannot.
   */
  beforeAnnounce(fact: string): Promise<void>;
}
