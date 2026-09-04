/** How often a batch leaves, and how the beat stops. */
export class Beat {
  private constructor(
    private readonly timer: ReturnType<typeof setInterval> | undefined,
    private readonly run: () => Promise<void>,
  ) {}

  /**
   * `unref` so a buffered record never keeps a process alive: exporting is something the
   * process does on its way, never a reason for it to stay.
   */
  static every(ms: number | undefined, run: () => Promise<void>): Beat {
    const every = ms ?? 1_000;
    const timer = every > 0 ? setInterval(() => void run(), every) : undefined;
    timer?.unref?.();

    return new Beat(timer, run);
  }

  /** Stop the timer, then send what is left — the order a process about to exit needs. */
  async stop(): Promise<void> {
    if (this.timer) clearInterval(this.timer);
    await this.run();
  }
}
