/** The realization that can tell whose frame is open: an async context. */
import { AsyncLocalStorage } from 'node:async_hooks';
import type { Ambient, Slot } from './ambient-port.js';

const frame = new AsyncLocalStorage<string>();
const slots = new Map<string, Slot<unknown>>();

export const ambient: Ambient = {
  degraded: false,

  slot<T>(name: string): Slot<T> {
    const held = slots.get(name);
    if (held) return held as Slot<T>;

    const storage = new AsyncLocalStorage<T>();
    const made: Slot<T> = { current: () => storage.getStore(), within: (value, fn) => storage.run(value, fn) };
    slots.set(name, made as Slot<unknown>);

    return made;
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
