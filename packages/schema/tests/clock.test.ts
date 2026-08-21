/**
 * What "now" means, when a test needs it to hold still.
 *
 * One place reads the clock — `applyCreate` and `applyUpdate` share it — because those two
 * are where `created()`, `updated()` and `create: 'now'` are realized. So freezing it is a
 * value, not an interception: nothing here is a channel, and a stable instant is a fact
 * about the run.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { entity, primary, text, created, updated, applyCreate, applyUpdate, freezeClock } from '../src/index.js';

class Post extends entity({
  id: primary(),
  title: text({ min: 1 }),
  createdAt: created(),
  updatedAt: updated(),
}) {}

let restore: (() => void) | undefined;
afterEach(() => { restore?.(); restore = undefined; });

describe('a frozen clock', () => {
  it('stamps the instant the test named', () => {
    const at = new Date('2026-01-02T03:04:05.000Z');
    restore = freezeClock(at);

    const row = applyCreate(Post.getFields(), { title: 'A title' }) as { createdAt: Date };

    expect(row.createdAt.toISOString()).toBe(at.toISOString());
  });

  it('holds across two stamps, so a created and an updated row agree', () => {
    restore = freezeClock(1_767_000_000_000);

    const created = applyCreate(Post.getFields(), { title: 'A' }) as { createdAt: Date };
    const updated = applyUpdate(Post.getFields(), {}) as { updatedAt: Date };

    expect(updated.updatedAt.getTime()).toBe(created.createdAt.getTime());
  });

  it('moves again once released', () => {
    const release = freezeClock(0);
    const frozen = applyCreate(Post.getFields(), { title: 'A' }) as { createdAt: Date };
    release();

    const live = applyCreate(Post.getFields(), { title: 'A' }) as { createdAt: Date };

    expect(frozen.createdAt.getTime()).toBe(0);
    expect(live.createdAt.getTime()).toBeGreaterThan(0);
  });
});
