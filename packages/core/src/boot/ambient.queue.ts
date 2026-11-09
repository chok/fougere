import type { Ambient, Slot } from './ambient-port.js';

const NESTED_TIMEOUT_MS = 5_000;

let busy: Promise<void> | undefined;
let holder: string | undefined;

const settled = () => undefined;

function raceWith(p: Promise<void>, ms: number): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    const clear = () => { clearTimeout(timer); resolve(); };
    void p.then(clear, clear);
  });
}

const empty: Slot<never> = { current: () => undefined, within: (_value, fn) => fn() };

export const ambient: Ambient = {
  degraded: true,

  slot: <T>(_name: string) => empty as Slot<T>,

  async enterFrame<R>(key: string, fn: () => Promise<R>): Promise<R> {
    const deadline = Date.now() + NESTED_TIMEOUT_MS;
    for (;;) {
      if (busy === undefined) break;
      const left = deadline - Date.now();
      if (left <= 0) {
        throw new Error(
          `Together ${key} waited ${NESTED_TIMEOUT_MS}ms for ${holder} and gave up: it was probably opened inside it. `
          + `Use one Together that lists every entity of both.`,
        );
      }
      await raceWith(busy, left);
    }
    let release = settled as () => void;
    busy = new Promise<void>((resolve) => { release = resolve; });
    holder = key;
    try {
      return await fn();
    } finally {
      busy = undefined;
      holder = undefined;
      release();
    }
  },

  /** Waits rather than refuses, since whose frame is open cannot be told here. */
  async beforeAnnounce(_fact: string): Promise<void> {
    while (busy) await raceWith(busy, NESTED_TIMEOUT_MS);
  },
};
