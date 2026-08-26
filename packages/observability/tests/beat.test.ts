/**
 * The beat, and the one decision it holds: `flushMs: 0` means no timer at all.
 *
 * That is not a preference. An app built at module scope builds its exporter there, and
 * Cloudflare refuses a deployment whose module scope sets a timeout — measured, error
 * 10021. Both exporters used to spell this rule themselves, so it could drift.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { Beat } from '../src/Beat.js';

afterEach(() => { vi.useRealTimers(); });

describe('Beat', () => {
  it('sets no timer when the interval is zero — the only legal form on a Worker', () => {
    vi.useFakeTimers();
    const run = vi.fn(async () => {});
    Beat.every(0, run);

    vi.advanceTimersByTime(10_000);
    expect(run).not.toHaveBeenCalled();
  });

  it('runs on its own beat, and defaults to every second', () => {
    vi.useFakeTimers();
    const run = vi.fn(async () => {});
    Beat.every(undefined, run);

    vi.advanceTimersByTime(3_000);
    expect(run).toHaveBeenCalledTimes(3);
  });

  it('stops the timer first, then sends what is left', async () => {
    vi.useFakeTimers();
    const run = vi.fn(async () => {});
    const beat = Beat.every(1_000, run);

    await beat.stop();
    expect(run).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(10_000);
    expect(run).toHaveBeenCalledTimes(1);
  });
});
