/**
 * The realization for a runtime with no async context: it cannot tell whose frame is
 * open, so it never guesses — it waits its turn.
 *
 * Two consequences the boot reports rather than hides: frames run one at a time, and a
 * frame opened inside another is not refused, it waits for itself and times out.
 */
import type { Ambient } from './ambient-port.js';

/** What a nested frame waits before it is told what it did — the hang, measured, plus a name. */
const NESTED_TIMEOUT_MS = 5_000;

let busy: Promise<void> | undefined;
let holder: string | undefined;

const settled = () => undefined;

/** Resolves when `p` settles or `ms` elapses, whichever comes first, holding no timer after. */
function raceWith(p: Promise<void>, ms: number): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    const clear = () => { clearTimeout(timer); resolve(); };
    void p.then(clear, clear);
  });
}

export const ambient: Ambient = {
  degraded: true,

  async enterFrame<R>(key: string, fn: () => Promise<R>): Promise<R> {
    const deadline = Date.now() + NESTED_TIMEOUT_MS;
    for (;;) {
      // Nothing may await between this test and the reservation below, or two waiters
      // woken in the same tick would both take the frame.
      if (busy === undefined) break;
      const left = deadline - Date.now();
      if (left <= 0) {
        throw new Error(
          `Together<[…]> (${key}) waited ${NESTED_TIMEOUT_MS}ms for ${holder} and gave up. `
          + `This runtime has no async context, so a frame opened inside another waits for `
          + `itself instead of being refused. Two frames that must both hold are ONE frame — `
          + `declare a single Together naming every member.`,
        );
      }
      await raceWith(busy, left);
    }
    // Held BEFORE `fn` runs: the first thing a frame's body does may be to open another,
    // and reserving on the returned promise would be one tick too late to see it.
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

  /**
   * Waits rather than refuses: whose frame is open cannot be told here, and refusing on
   * that would refuse an announcement made by an unrelated call.
   */
  async beforeAnnounce(_fact: string): Promise<void> {
    while (busy) await raceWith(busy, NESTED_TIMEOUT_MS);
  },

  /** No chain can be followed here — an emission ring is not detected. Said at boot. */
  currentChain: () => [],

  enterChain<R>(_fact: string, fn: () => Promise<R>): Promise<R> {
    return fn();
  },
};
