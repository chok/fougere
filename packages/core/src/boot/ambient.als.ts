/** The realization that can tell whose frame is open: an async context. */
import { AsyncLocalStorage } from 'node:async_hooks';
import type { Ambient } from './ambient-port.js';
import type { DoorRequest } from '../wire/DoorRequest.js';

const frame = new AsyncLocalStorage<string>();
const chain = new AsyncLocalStorage<readonly string[]>();
const operation = new AsyncLocalStorage<string>();
const request = new AsyncLocalStorage<DoorRequest>();

export const ambient: Ambient = {
  degraded: false,

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

  currentChain: () => chain.getStore() ?? [],

  enterChain<R>(fact: string, fn: () => Promise<R>): Promise<R> {
    return chain.run([...(chain.getStore() ?? []), fact], fn);
  },

  currentOperation: () => operation.getStore(),

  enterOperation<R>(label: string, fn: () => Promise<R>): Promise<R> {
    return operation.run(label, fn);
  },

  currentRequest: () => request.getStore(),

  enterRequest<R>(entered: DoorRequest, fn: () => Promise<R>): Promise<R> {
    return request.run(entered, fn);
  },
};
