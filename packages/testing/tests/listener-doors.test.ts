/**
 * An op that takes a `Fact<T>` is called by the announcement and by no caller: REST serves no route
 * to it, GraphQL no field, and the envelope a page calls refuses it. The announcement still reaches
 * it — through the facade, as before.
 */
import '@fougere/adapter-graphql';
import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { generateRoutes } from '@fougere/adapter-rest';
import { schemaOf } from '@fougere/adapter-graphql';
import { serveRpc } from '@fougere/app';
import { createLocalRunner } from '@fougere/core';
import { Invocation } from '@fougere/core/contract';
import { testApp } from '../src/index.js';

const root = join(import.meta.dirname, 'fixtures-emit');

describe('an op an announcement calls', () => {
  it('has no REST route and no GraphQL field, where its frond\'s other ops do', async () => {
    await using app = await testApp({ root });
    const routes = generateRoutes(app).filter((route) => route.address === 'indexed').map((route) => route.operationName);
    const mutations = Object.keys(schemaOf(app as never).getMutationType()!.getFields());

    expect(routes).toContain('create');
    expect(routes).not.toContain('reindex');
    expect(mutations.some((name) => /reindex/i.test(name))).toBe(false);
  });

  it('is refused to a page, and still reached by the announcement', async () => {
    await using app = await testApp({ root });
    const refused = await serveRpc(app, {
      path: '/_fougere/call',
      body: { jsonrpc: '2.0', id: 1, method: 'indexed.reindex', params: { input: { id: 'p1', title: 'Forged' } } },
      state: {},
    }) as { error: { data: { code: string } } };

    const run = createLocalRunner(app);
    const post = await run({ address: 'post', op: 'create' }, { ...Invocation.empty, input: { title: 'A title' } }) as { id: string };
    await run({ address: 'post', op: 'publish' }, { ...Invocation.empty, input: { id: post.id, title: 'A title' } });

    expect(refused.error.data.code).toBe('NOT_FOUND');
    expect(await run({ address: 'indexed', op: 'list' }, Invocation.empty)).toMatchObject({ items: [{ postId: post.id, title: 'A title' }] });
  });
});
