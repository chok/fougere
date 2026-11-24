/**
 * The conventional boot, reading what a config says about its fronds.
 *
 * `core` is where the tree is judged and where a scope hangs off its parent's; what is under
 * test here is the HOST half — that `boot()` reads `fronds:` and `processes:` off the
 * file at all, and hands both over.
 */
import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { createContainer } from '@fougere/container';
import { createLocalRunner, Invocation } from '@fougere/core';
import { boot } from '../src/boot.js';

const root = join(import.meta.dirname, 'fixtures-boot-tree');

/** The topology places `blog` at an address, and an address with no transport is refused. */
const remoteTransport = () => async () => undefined;

describe('boot, on a project whose config states a tree', () => {
  it('lets a child resolve what its parent declared', async () => {
    await using app = await boot({ root, createContainer, remoteTransport });

    const out = await createLocalRunner(app)({ address: 'cart', op: 'quote' }, Invocation.empty);

    expect(out).toBe('12.50 EUR');
  });

  it('reaches a frond another process runs at that process url', async () => {
    await using app = await boot({ root, createContainer, remoteTransport });

    expect(app.remotes).toEqual({ blog: 'http://127.0.0.1:4321' });
  });

  it('runs, as the app, every frond the topology places nowhere else', async () => {
    await using app = await boot({ root, createContainer, remoteTransport });

    expect(app.fronds.map((frond) => frond.name)).toEqual(['shop', 'cart']);
  });
});
