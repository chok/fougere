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

  /**
   * Subscribe after the dispatcher was built, and get the unsubscription back.
   *
   * The list used to be settled at construction, so only the caller of `createApp` could
   * observe — an extension, which runs in `up(app)`, could not. `app.use` already adds a
   * middleware this late; this is its dual, and the pair is *participate* / *watch*.
   */
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
