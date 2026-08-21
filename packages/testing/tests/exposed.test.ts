/**
 * The divergence the comparison exists to find.
 *
 * `expose: []` in a frond's config says nothing is part of the public contract.
 * `adapter/rest/src/routes.ts` and `adapter/graphql/src/auto-register.ts` both read it —
 * `if (!surfaceName && entity.exposed === false) continue` — and nothing in
 * `core/src/boot/` does. So the entity vanishes from two doors and keeps answering on the
 * third, which is the one a browser calls.
 *
 * Recorded as a test rather than as a paragraph: `CLAUDE.md` has carried this as a Known
 * issue for a while, and a paragraph never told anyone the day it changed.
 */
import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { createLocalRunner } from '@fougere/core';
import { EMPTY_INVOCATION } from '@fougere/core/contract';
import { serveRest, serveRpc, tableOf } from '@fougere/app';
import { testApp } from '../src/index.js';

const root = join(import.meta.dirname, 'fixtures-exposed');

describe('an entity withdrawn from the public contract', () => {
  it('is served by no REST route', async () => {
    await using app = await testApp({ root });

    expect(tableOf(app).filter((route) => route.entityName === 'secret')).toEqual([]);
  });

  it('is absent from the GraphQL schema', async () => {
    await using app = await testApp({ root });
    const { schemaOf } = await import('@fougere/adapter-graphql');

    const fields = Object.keys(schemaOf(app as never).getQueryType()?.getFields() ?? {});

    expect(fields).not.toContain('secret');
    expect(fields).not.toContain('secrets');
  });

  it('answers over RPC all the same — the two readers are not three', async () => {
    await using app = await testApp({ root });

    const local = await createLocalRunner(app)({ entity: 'secret', op: 'list' }, EMPTY_INVOCATION);
    const overRpc = await serveRpc(app, {
      path: '',
      body: { jsonrpc: '2.0', id: 1, method: 'secret.list', params: EMPTY_INVOCATION },
      state: {},
    }) as { result?: unknown; error?: unknown };

    // Both answer. Whether that is right is a decision; that the three doors disagree
    // is a fact, and this is where it is written down.
    expect(local).toBeTruthy();
    expect(overRpc.error).toBeUndefined();
    expect(overRpc.result).toBeTruthy();
  });

  it('makes REST answer nothing where RPC answers rows', async () => {
    await using app = await testApp({ root });

    const rest = await serveRest(app, { method: 'GET', path: 'vault/secrets', query: {}, state: {} });

    // `pass` is the door saying "not mine" — a host would fall through to a 404.
    expect(rest.kind).toBe('pass');
  });
});
