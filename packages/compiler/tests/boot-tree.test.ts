/**
 * The conventional boot, reading what a config says about its fronds.
 *
 * `core` is where the tree is judged and where a scope hangs off its parent's; what is under
 * test here is the HOST half — that `boot()` reads `fronds:` off the file at all, hands the
 * tree over, and folds a string leaf into the same topology `remotes:` states.
 */
import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { createContainer } from '@fougere/container';
import { createLocalRunner, Invocation } from '@fougere/core';
import { boot } from '../src/boot.js';

const root = join(import.meta.dirname, 'fixtures-boot-tree');

/** The config places `blog` at an address, and an address with no transport is refused. */
const remoteTransport = () => async () => undefined;

describe('boot, on a project whose config states a tree', () => {
  it('lets a child resolve what its parent declared', async () => {
    await using app = await boot({ root, createContainer, remoteTransport });

    const out = await createLocalRunner(app)({ entity: 'cart', op: 'quote' }, Invocation.empty);

    expect(out).toBe('12.50 EUR');
  });

  it('reads a string leaf as the address it is', async () => {
    await using app = await boot({ root, createContainer, remoteTransport });

    // `blog: 'http://…'` in the tree says what `remotes: { blog: … }` says. This boot read
    // neither off the file until now, so a project stating its topology got a process that
    // believed every frond was local.
    expect(app.remotes).toEqual({ blog: 'http://127.0.0.1:4321' });
  });

  it('narrows what this process carries with `only:`, which is another question', async () => {
    await using app = await boot({ root, createContainer, remoteTransport, only: ['shop', 'cart'] });

    expect(app.fronds.map((frond) => frond.name)).toEqual(['shop', 'cart']);
  });

  it('refuses to carry a child without the frond it inherits from', async () => {
    // `only:` narrows what one process holds; it may not cut a family in half, since the code
    // `cart` resolves would simply not be there.
    await expect(boot({ root, createContainer, remoteTransport, only: ['cart'] }))
      .rejects.toThrow(/frond-family-split[\s\S]*'cart' inherits from 'shop'/);
  });
});
