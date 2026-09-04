import type { DispatchEvent, DispatchObserver } from './DispatchEvent.js';

/** Publishes dispatch transitions without participating in dispatch decisions. */
export class DispatchLifecycle {
  private readonly observers: DispatchObserver[];

  constructor(
    observers: readonly DispatchObserver[] = [],
    private readonly diagnose: (error: unknown, event: DispatchEvent) => void = () => {},
  ) {
    this.observers = [...observers];
  }

  /** Subscribe after the dispatcher was built, and get the unsubscription back. */
  add(observer: DispatchObserver): () => void {
    this.observers.push(observer);

    return () => {
      const at = this.observers.indexOf(observer);
      if (at !== -1) this.observers.splice(at, 1);
    };
  }

  publish(event: DispatchEvent): void {
    for (const observer of this.observers) {
      try {
        observer(event);
      } catch (error) {
        try {
          this.diagnose(error, event);
        } catch {
          // Diagnostics remain observational too.
        }
      }
    }
  }
}
