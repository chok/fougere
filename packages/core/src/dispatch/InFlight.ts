import { ErrorCode } from '../wire/ErrorCode.js';
import { FougereError } from '../wire/FougereError.js';

/** Controls dispatch admission and signals when every accepted call has settled. */
export class InFlight {
  private running = 0;
  private accepting = true;
  private idle: (() => void)[] = [];

  get count(): number {
    return this.running;
  }

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
    let released = false;

    return () => {
      if (released) return;
      released = true;
      this.running--;
      if (this.running !== 0) return;

      const waiting = this.idle;
      this.idle = [];
      for (const wake of waiting) wake();
    };
  }

  /** Close the door, and answer once the calls already running are done — or refuse at the deadline, naming what is left. */
  async drain(timeoutMs?: number): Promise<void> {
    this.accepting = false;
    if (timeoutMs === undefined) return this.whenIdle();

    let timer: ReturnType<typeof setTimeout>;

    await Promise.race([
      this.whenIdle().then(() => clearTimeout(timer)),
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`[drain] ${this.running} call(s) still running after ${timeoutMs}ms`)),
          timeoutMs,
        );
      }),
    ]);
  }

  private whenIdle(): Promise<void> {
    if (this.running === 0) return Promise.resolve();

    return new Promise((resolve) => this.idle.push(resolve));
  }
}
