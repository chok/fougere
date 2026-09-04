/** What a call needs to know about the call it is inside, and the two ways to answer it. */
export interface Ambient {
  /** True when this runtime has no async context, and the boot says so. */
  readonly degraded: boolean;

  /** Run `fn` as the frame `key`. */
  enterFrame<R>(key: string, fn: () => Promise<R>): Promise<R>;

  /**
   * Settle before `fact` is dispatched: a fact announced inside a frame that then rolls
   * back is a lie. Refuses when the caller's own frame can be told, waits when it cannot.
   */
  beforeAnnounce(fact: string): Promise<void>;

  /** The facts already being announced up the stack, so a fact cannot cause itself. */
  currentChain(): readonly string[];

  /** Run `fn` with `fact` appended to the emission chain. */
  enterChain<R>(fact: string, fn: () => Promise<R>): Promise<R>;
}
