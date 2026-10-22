/** The realization that can tell whose frame is open: an async context, whichever runtime hands it over. */
import type { Ambient, Slot } from './ambient-port.js';

/** What `AsyncLocalStorage` is to this realization — the class, never its module. */
export interface AsyncContext {
  new <T>(): { getStore(): T | undefined; run<R>(store: T, fn: () => R): R };
}

export function ambientOver(AsyncLocalStorage: AsyncContext): Ambient {
  const frame = new AsyncLocalStorage<string>();
  const slots = new Map<string, Slot<unknown>>();

  return {
    degraded: false,

    slot<T>(name: string): Slot<T> {
      const existing = slots.get(name);
      if (existing) return existing as Slot<T>;

      const storage = new AsyncLocalStorage<T>();
      const slot: Slot<T> = { current: () => storage.getStore(), within: (value, fn) => storage.run(value, fn) };
      slots.set(name, slot as Slot<unknown>);

      return slot;
    },

    enterFrame<R>(key: string, fn: () => Promise<R>): Promise<R> {
      const open = frame.getStore();
      if (open !== undefined) {
        return Promise.reject(new Error(
          `Together ${key} is opened inside Together ${open}, which would hang. `
          + `Use one Together that lists every entity of both.`,
        ));
      }

      return frame.run(key, fn);
    },

    beforeAnnounce(fact: string): Promise<void> {
      const open = frame.getStore();
      if (open === undefined) return Promise.resolve();

      return Promise.reject(new Error(
        `${fact} is announced inside Together ${open}, whose writes may still be undone. `
        + `Announce it after run() returns.`,
      ));
    },
  };
}
