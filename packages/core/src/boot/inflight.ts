import { FougereError, ErrorCode } from '../wire/errors.js';

/**
 * The calls this app is running right now, and the one way to know it has finished.
 *
 * It exists for a single moment: an app being let go while work is still on it. Turning
 * the ring — or shutting down — releases what the running calls are standing on (a
 * storage connection, a scope full of providers), so "release it later" needs a *later*
 * that something can name. Nothing counted before, so there was none.
 *
 * The counter sits at the door every caller already goes through (`HandlerFacade.wrap`),
 * which is what makes it honest: the three projections and the wire share that path, so
 * one count covers them all. A nested call counts twice, on purpose — the app is not
 * idle while an inner op is still running.
 */
export class InFlight {
  private running = 0;
  private accepting = true;
  private idle: Array<() => void> = [];

  /** How many calls are on this app now. */
  get count(): number {
    return this.running;
  }

  /** Whether new calls are still taken. */
  get open(): boolean {
    return this.accepting;
  }

  /**
   * Take a ticket for a call about to run, and hand back the way to give it up.
   *
   * Refused once the door is closed: the ring has already swapped the handle, so a call
   * arriving here is one whose caller kept a reference across the turn. Answering it on
   * an app being released would be worse than refusing it.
   */
  enter(entity: string, operation: string): () => void {
    if (!this.accepting) {
      throw new FougereError({
        code: ErrorCode.SERVICE_UNAVAILABLE,
        message: 'This app is being released and takes no new call — reach the current one through its handle.',
        entity,
        operation,
      });
    }
    this.running++;
    let given = false;
    return () => {
      // Idempotent: a caller that both throws and returns must not count twice.
      if (given) return;
      given = true;
      this.running--;
      if (this.running === 0) {
        const waiting = this.idle;
        this.idle = [];
        for (const wake of waiting) wake();
      }
    };
  }

  /** Stop taking calls. Says nothing about the ones already running. */
  close(): void {
    this.accepting = false;
  }

  /** Resolves when no call is left. Immediate when none is running. */
  whenIdle(): Promise<void> {
    if (this.running === 0) return Promise.resolve();
    return new Promise((resolve) => this.idle.push(resolve));
  }
}
