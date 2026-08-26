import { FougereError, ErrorCode } from '../wire/errors.js';

/** Controls dispatch admission and signals when every accepted call has settled. */
export class InFlight {
  private running = 0;
  private accepting = true;
  private idle: (() => void)[] = [];

  get count(): number {
    return this.running;
  }

  get open(): boolean {
    return this.accepting;
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

  close(): void {
    this.accepting = false;
  }

  whenIdle(): Promise<void> {
    if (this.running === 0) return Promise.resolve();
    return new Promise((resolve) => this.idle.push(resolve));
  }
}
