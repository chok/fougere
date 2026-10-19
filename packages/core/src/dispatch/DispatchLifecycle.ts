import type { DispatchEvent } from './DispatchEvent.js';
import type { DispatchObserver } from './DispatchObserver.js';
import type { DoorEvent } from './DoorEvent.js';
import type { DoorRequest } from '../wire/DoorRequest.js';

/** Publishes dispatch transitions without participating in dispatch decisions. */
export class DispatchLifecycle {
  private readonly observers: DispatchObserver[];

  constructor(
    observers: readonly DispatchObserver[] = [],
    private readonly diagnose: (error: unknown, event: DispatchEvent | DoorEvent) => void = () => {},
    /** The request at a door the code runs within, read off the async context. */
    readonly request: () => DoorRequest | undefined = () => undefined,
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

  publish(event: DispatchEvent | DoorEvent): void {
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
