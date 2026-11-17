import { afterAll, describe, expect, it } from 'vitest';
import { join } from 'node:path';
import { createLocalRunner, Invocation } from '@fougere/core';
import { tableOf } from '@fougere/app';
import { answer } from '@fougere/app/answer';
import { executeOn, schemaOf } from '@fougere/adapter-graphql';
import { testApp } from '../src/index.js';
import { at, mutationFor } from '../src/gql.js';
import Article from './fixtures/fronds/press/entities/Article.js';

const app = await testApp({ root: join(import.meta.dirname, 'fixtures'), fronds: ['press'] });
afterAll(() => app.dispose());

const draft = { title: 'A draft', body: 'Soon out', status: 'draft', views: 0 };
const compared = (row: unknown) => {
  const { id, title, status } = row as { id: string; title: string; status: string };

  return { id, title, status };
};

async function created(): Promise<string> {
  const row = await createLocalRunner(app)({ address: 'article', op: 'create' }, { ...Invocation.empty, input: draft as never });

  return (row as { id: string }).id;
}

async function viaRpc(id: string): Promise<unknown> {
  const body = { jsonrpc: '2.0', id: 1, method: 'article.publish', params: { ...Invocation.empty, params: { id } } };
  const response = await answer(app, new Request('http://localhost/_fougere/call', { method: 'POST', body: JSON.stringify(body) }));
  const answered = await response!.json() as { result?: unknown; error?: { message: string } };
  if (answered.error) throw new Error(answered.error.message);

  return answered.result;
}

async function viaRest(id: string): Promise<unknown> {
  const route = tableOf(app).find((one) => one.route.address === 'article' && one.route.operationName === 'publish');
  if (!route) throw new Error('REST serves no article.publish');
  const path = route.segments.map((segment) => (segment.startsWith(':') ? id : segment)).join('/');
  const response = await answer(app, new Request(`http://localhost/${path}`, { method: route.route.method }));
  if (!response || response.status >= 400) throw new Error(`REST answered ${response?.status ?? 'nothing'}`);

  return response.json();
}

async function viaGraphql(id: string): Promise<unknown> {
  const built = mutationFor(schemaOf(app as never) as never, Article, 'publish', { id });
  if (!built) throw new Error('GraphQL serves no article.publish');
  const answered = await executeOn(app as never, { query: built.query, state: {} });
  if (answered.errors?.length) throw new Error(answered.errors[0].message);

  return at(answered.data, built.at);
}

describe('an operation the handler writes itself answers the same at every door', () => {
  it('publish, through the envelope, REST and GraphQL', async () => {
    const [first, second, third] = [await created(), await created(), await created()];

    const rpc = compared(await viaRpc(first));
    expect(rpc).toEqual({ id: first, title: draft.title, status: 'published' });
    expect(compared(await viaRest(second))).toEqual({ ...rpc, id: second });
    expect(compared(await viaGraphql(third))).toEqual({ ...rpc, id: third });
  });
});
