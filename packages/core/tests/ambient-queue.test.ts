import { describe, it, expect, vi, afterEach } from 'vitest';
import { ambient } from '../src/boot/ambient.queue.js';

/** The realization for a runtime with no async context — what it trades, stated as tests. */
describe('ambient.queue', () => {
  afterEach(() => vi.useRealTimers());

  it('runs frames one at a time', async () => {
    const order: string[] = [];
    const a = ambient.enterFrame('A', async () => {
      order.push('a in');
      await Promise.resolve();
      order.push('a out');
    });
    const b = ambient.enterFrame('B', async () => { order.push('b in'); });
    await Promise.all([a, b]);
    expect(order).toEqual(['a in', 'a out', 'b in']);
  });

  it('a frame opened inside another times out instead of being refused', async () => {
    vi.useFakeTimers();
    await ambient.enterFrame('A', async () => {
      // Asserted BEFORE the clock moves: the rejection would otherwise cross a microtask
      // with nobody listening, and vitest reports that as an unhandled error.
      const refused = expect(ambient.enterFrame('B', async () => 'never'))
        .rejects.toThrow(/\(B\) waited 5000ms for A/);
      await vi.advanceTimersByTimeAsync(5_000);
      await refused;
    });
  });

  it('an announcement waits for the open frame rather than being refused', async () => {
    const seen: string[] = [];
    const frame = ambient.enterFrame('A', async () => {
      await Promise.resolve();
      seen.push('frame done');
    });
    const announced = ambient.beforeAnnounce('postPublished').then(() => seen.push('announced'));
    await Promise.all([frame, announced]);
    expect(seen).toEqual(['frame done', 'announced']);
  });

  it('follows no emission chain, and says so by answering empty', async () => {
    expect(ambient.currentChain()).toEqual([]);
    await ambient.enterChain('a', async () => {
      expect(ambient.currentChain()).toEqual([]);
    });
  });
});
