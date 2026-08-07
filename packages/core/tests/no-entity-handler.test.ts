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
import { createContainer } from '@fougere/container-fougere';
import { createApp, createLocalRunner } from '../src/index.js';
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
});
