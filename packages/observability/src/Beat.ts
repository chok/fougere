/**
 * How often a batch leaves, and how the beat stops.
 *
 * `flushMs: 0` means "nobody is on a timer here, I will say when" — and on a Worker it is
 * not a preference, it is the only legal form: Cloudflare REFUSES a deployment whose
 * module scope sets a timeout ("Disallowed operation called within global scope"), and an
 * app built at module scope builds its exporter there. Measured 2026-08-23, the deploy
 * failed with error 10021. The isolate is frozen at the response anyway, so the timer
 * could never have fired; `ctx.waitUntil(flushTelemetry())` is what sends.
 */
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
