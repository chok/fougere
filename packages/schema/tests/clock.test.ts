/**
 * What "now" means, when a test needs it to hold still.
 *
 * `applyCreate` and `applyUpdate` read the system clock at the write, so the runner's own fake
 * timers reach every `created()`, `updated()` and `create: 'now'` — nothing to import from here.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { entity, primary, text, created, updated, applyCreate, applyUpdate } from '../src/index.js';

class Post extends entity({
  id: primary(),
  title: text({ min: 1 }),
  createdAt: created(),
  updatedAt: updated(),
}) {}

afterEach(() => {
  vi.useRealTimers();
});

describe('a frozen clock', () => {
  it('stamps the instant the test named', () => {
    const at = new Date('2026-01-02T03:04:05.000Z');
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(at);

    const row = applyCreate(Post.getFields(), { title: 'A title' }) as { createdAt: Date };

    expect(row.createdAt.toISOString()).toBe(at.toISOString());
  });

  it('holds across two stamps, so a created and an updated row agree', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(1_767_000_000_000);

    const created = applyCreate(Post.getFields(), { title: 'A' }) as { createdAt: Date };
    const updated = applyUpdate(Post.getFields(), {}) as { updatedAt: Date };

    expect(updated.updatedAt.getTime()).toBe(created.createdAt.getTime());
  });

  it('moves again once the real clock is back', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(0);
    const frozen = applyCreate(Post.getFields(), { title: 'A' }) as { createdAt: Date };
    vi.useRealTimers();

    const live = applyCreate(Post.getFields(), { title: 'A' }) as { createdAt: Date };

    expect(frozen.createdAt.getTime()).toBe(0);
    expect(live.createdAt.getTime()).toBeGreaterThan(0);
  });
});
