/**
 * A handler names itself, and an entity is optional.
 *
 * The façade loop used to walk `frond.entities` and look a handler up by name, so a
 * handler naming no entity was scanned and then silently never built. An operation about
 * no stored row — a health check, a pure computation, a search across several shapes —
 * is an ordinary case, not a gap to accommodate.
 */
import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { createContainer } from '@fougere/container';
import { createApp, createLocalRunner } from '../src/index.js';
import { identityCardOf } from '../src/call.js';
import { EMPTY_INVOCATION } from '../src/invocation.js';

const root = join(import.meta.dirname, 'fixtures-no-entity');

describe('a handler with no entity', () => {
  it('is served, and answers', async () => {
    await using app = await createApp({ root, createContainer });

    const out = await createLocalRunner(app)({ entity: 'health', op: 'check' }, EMPTY_INVOCATION);

    expect(out).toEqual({ status: 'up' });
  });

  it('lets its result through untouched — there is no shape to project onto', async () => {
    await using app = await createApp({ root, createContainer });
    const facade = app.container.resolve<Record<string, Function>>('healthHandler');

    // Not `{}`: an absent field set means nothing to encode, not everything to drop.
    expect(Object.keys(facade)).toEqual(['check']);
    expect(await facade.check(EMPTY_INVOCATION)).toEqual({ status: 'up' });
  });

  it('is served under a NAMED surface too, not only the default one', async () => {
    await using app = await createApp({ root, createContainer });

    // The surface loop looked the entity up and skipped the handler when it found none,
    // so this door did not exist and `facadeFor` answered `undefined` — silently, while
    // the identical handler one directory up was built and logged.
    const door = app.facadeFor('health', 'public');

    expect(door).toBeDefined();
    expect(await door!.check(EMPTY_INVOCATION)).toEqual({ status: 'up', audience: 'public' });
  });

  it('keeps the two audiences apart — a surface is closed, it does not shadow', async () => {
    await using app = await createApp({ root, createContainer });

    expect(await app.facadeFor('health')!.check(EMPTY_INVOCATION)).toEqual({ status: 'up' });
  });

  it('appears in the identity card, so a consumer can discover it', async () => {
    await using app = await createApp({ root, createContainer });

    // The card walked `frond.entities`, so this door was built, served, and invisible:
    // `sync` could not generate it and a remote consumer had no way to know it existed.
    const card = identityCardOf(app);
    const health = card.fronds[0].doors.find((d) => d.name === 'health');

    expect(health?.ops.map((op) => op.name)).toEqual(['check']);
    // No shape, and that is the fact rather than an empty one: nothing is stored.
    expect(health?.schema).toBeUndefined();
  });

  it('carries its named surface into the card too', async () => {
    await using app = await createApp({ root, createContainer });

    const publicCard = identityCardOf(app, 'public');
    expect(publicCard.fronds[0].doors.map((d) => d.name)).toEqual(['health']);
  });
});
