import type { DispatchEvent, DispatchObserver } from './DispatchEvent.js';

/** Publishes dispatch transitions without participating in dispatch decisions. */
export class DispatchLifecycle {
  constructor(private readonly observers: readonly DispatchObserver[] = []) {}

  publish(event: DispatchEvent): void {
    for (const observer of this.observers) {
      try {
        observer(event);
      } catch {
        // Observation must not change routing or its result.
      }
    }
  }
}
