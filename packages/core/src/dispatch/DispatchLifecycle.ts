import type { DispatchEvent, DispatchObserver } from './DispatchEvent.js';

/** Publishes dispatch transitions without participating in dispatch decisions. */
export class DispatchLifecycle {
  constructor(private readonly observers: readonly DispatchObserver[] = []) {}

  publish(event: DispatchEvent): void {
    const immutable = Object.freeze(event);
    for (const observer of this.observers) {
      try {
        observer(immutable);
      } catch {
        // Observation must not change routing or its result.
      }
    }
  }
}
