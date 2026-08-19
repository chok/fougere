/**
 * What `app.dispose()` actually releases.
 *
 * It used to be `container.dispose()` and nothing else, so a resource handed IN — a
 * storage connection is the one case — stayed open when the app was let go. Harmless
 * while an app was booted once per process; it is the whole question once the ring
 * turns, because then apps are discarded on purpose.
 */
import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { createContainer } from '@fougere/container';
import { createApp } from '../src/index.js';

const root = join(import.meta.dirname, 'fixtures-ports');

describe('app.dispose', () => {
  it('releases what was handed in, after the container it was handed to', async () => {
    const order: string[] = [];
    const container = createContainer();
    const disposeContainer = container.dispose.bind(container);
    container.dispose = async () => { order.push('container'); await disposeContainer(); };

    const app = await createApp({
      root,
      createContainer: () => container,
      onDispose: async () => { order.push('handed in'); },
    });
    await app.dispose();

    expect(order).toEqual(['container', 'handed in']);
  });

  it('disposes a provider that says how — the container contract, unchanged', async () => {
    let closed = false;
    const app = await createApp({ root, createContainer });
    const scope = app.resolve<ReturnType<typeof createContainer>>('frond:billing');
    scope.register('Pool', class { dispose() { closed = true; } }, { lifetime: 'singleton' });
    scope.resolve('Pool');

    await app.dispose();

    expect(closed).toBe(true);
  });

  it('still resolves through `await using`, which routes to the same release', async () => {
    let released = false;
    {
      await using app = await createApp({ root, createContainer, onDispose: () => { released = true; } });
      expect(app.fronds).toHaveLength(1);
    }
    expect(released).toBe(true);
  });
});
