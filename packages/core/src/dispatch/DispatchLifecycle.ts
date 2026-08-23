import type { DispatchEvent, DispatchObserver } from './DispatchEvent.js';

/** Publishes dispatch transitions without participating in dispatch decisions. */
export class DispatchLifecycle {
  constructor(
    private readonly observers: readonly DispatchObserver[] = [],
    private readonly diagnose: (error: unknown, event: DispatchEvent) => void = () => {},
  ) {}

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
