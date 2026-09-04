/** The realization that can tell whose frame is open: an async context. */
import { AsyncLocalStorage } from 'node:async_hooks';
import type { Ambient } from './ambient-port.js';

const frame = new AsyncLocalStorage<string>();
const chain = new AsyncLocalStorage<readonly string[]>();

export const ambient: Ambient = {
  degraded: false,

  enterFrame<R>(key: string, fn: () => Promise<R>): Promise<R> {
    const open = frame.getStore();
    if (open !== undefined) {
      return Promise.reject(new Error(
        `Together<[…]> (${key}) cannot be opened inside ${open}: on one engine the second `
        + `transaction waits for the first and the call hangs. Two frames that must both hold `
        + `are ONE frame — declare a single Together naming every member.`,
      ));
    }
    return frame.run(key, fn);
  },

  beforeAnnounce(fact: string): Promise<void> {
    const open = frame.getStore();
    if (open === undefined) return Promise.resolve();
    return Promise.reject(new Error(
      `${fact} cannot be announced inside Together<[…]> (${open}): announcing is dispatch, `
      + `so subscribers and the carrier would have it while these writes can still be taken `
      + `back. Announce after run() returns, when it is true.`,
    ));
  },

  currentChain: () => chain.getStore() ?? [],

  enterChain<R>(fact: string, fn: () => Promise<R>): Promise<R> {
    return chain.run([...(chain.getStore() ?? []), fact], fn);
  },
};
