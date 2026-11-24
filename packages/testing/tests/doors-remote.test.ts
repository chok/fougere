import { afterAll, describe, expect, it } from 'vitest';
import { join } from 'node:path';
import { createAppRunner, createLocalRunner, ErrorCode, migrating, Invocation, type Transport } from '@fougere/core';
import { boot, resolveStorage } from '@fougere/defaults';
import { answer } from '@fougere/app/answer';
import { schemaOf } from '@fougere/adapter-graphql';
import { testApp } from '../src/index.js';
import { listQuery } from '../src/gql.js';
import Article from './fixtures/fronds/press/entities/Article.js';

const root = join(import.meta.dirname, 'fixtures');

const far = await testApp({ root, fronds: ['press'] });

const acrossTheWire = (run: Transport): Transport => (call, invocation) =>
  run(call, { ...JSON.parse(JSON.stringify(invocation)), fromAnotherProcess: true });

const storage = resolveStorage({ main: { type: 'sqlite', path: ':memory:' } });
const near = await boot({
  root,
  only: ['press'],
  config: { fronds: {} },
  remotes: { press: 'http://press.test' },
  remoteTransport: () => acrossTheWire(createLocalRunner(far)),
  storage: () => storage,
  extensions: [migrating(storage.migrate)],
});

afterAll(async () => {
  await near.dispose();
  await far.dispose();
});

const sent = { title: 'Across the wire', body: 'Same answer', status: 'draft', views: 1 };
const wire = (value: unknown): unknown => JSON.parse(JSON.stringify(value ?? null));
const rowsOf = (value: unknown): unknown => (value && typeof value === 'object' && 'items' in value ? (value as { items: unknown }).items : value);

async function rpc(op: string, params: Record<string, unknown>): Promise<{ result?: unknown; error?: { code: number; data?: { code: string } } }> {
  const body = { jsonrpc: '2.0', id: 1, method: `article.${op}`, params: { ...Invocation.empty, ...params } };
  const response = await answer(near, new Request('http://localhost/_fougere/call', { method: 'POST', body: JSON.stringify(body) }));

  return response!.json() as never;
}

describe('a frond served by another process — the caller’s doors agree with the frond’s own', () => {
  it('lists the same rows through the topology and the envelope', async () => {
    await createLocalRunner(far)({ address: 'article', op: 'create' }, { ...Invocation.empty, input: sent as never });
    const own = wire(rowsOf(await createLocalRunner(far)({ address: 'article', op: 'list' }, Invocation.empty)));

    expect(wire(rowsOf(await createAppRunner(near)({ address: 'article', op: 'list' }, Invocation.empty))), 'topology ≠ own').toEqual(own);
    expect(wire(rowsOf((await rpc('list', {})).result)), 'envelope ≠ own').toEqual(own);
  });

  it('builds the GraphQL schema of the calling process, and leaves out the frond it does not host', async () => {
    expect(listQuery(schemaOf(near as never) as never, Article)).toBeUndefined();
    expect(listQuery(schemaOf(far as never) as never, Article)).toBeDefined();
  });

  it('refuses the same input with the same code, wherever it is asked', async () => {
    const short = { ...sent, title: 'ab' };

    await expect(createLocalRunner(far)({ address: 'article', op: 'create' }, { ...Invocation.empty, input: short as never }))
      .rejects.toMatchObject({ code: ErrorCode.VALIDATION_FAILED });
    await expect(createAppRunner(near)({ address: 'article', op: 'create' }, { ...Invocation.empty, input: short as never }))
      .rejects.toMatchObject({ code: ErrorCode.VALIDATION_FAILED });
    expect((await rpc('create', { input: short })).error).toMatchObject({ data: { code: ErrorCode.VALIDATION_FAILED } });
  });

  it('serves no REST route for it: the route answers where the frond is hosted', async () => {
    const response = await answer(near, new Request('http://localhost/api/press/articles'));

    expect(response === undefined || response.status === 404).toBe(true);
  });
});
