export type EventHandler = (payload: unknown) => void | Promise<void>;

/**
 * In-process event bus for inter-frond communication.
 *
 * Services emit domain events, other services listen.
 * Replaceable by a distributed bus later without changing business code.
 */
export class EventBus {
  private listeners = new Map<string, EventHandler[]>();

  /** Subscribe to an event. Returns an unsubscribe function. */
  on(event: string, handler: EventHandler): () => void {
    const handlers = this.listeners.get(event) ?? [];
    handlers.push(handler);
    this.listeners.set(event, handlers);
    return () => {
      const idx = handlers.indexOf(handler);
      if (idx >= 0) handlers.splice(idx, 1);
    };
  }

  /** Emit an event. All handlers are called concurrently. */
  async emit(event: string, payload?: unknown): Promise<void> {
    const handlers = this.listeners.get(event) ?? [];
    await Promise.all(handlers.map((h) => h(payload)));
  }

  /** Remove all listeners (useful for testing / dispose). */
  clear(): void {
    this.listeners.clear();
  }
}
