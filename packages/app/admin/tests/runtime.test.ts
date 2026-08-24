import { describe, expect, it } from 'vitest';
import { Card, entity, primary, text } from '@fougere/schema';
import type { Fetcher } from '@fougere/app/client';
import type { IdentityCard } from '@fougere/core/contract';
import { createAdminRuntime } from '../src/runtime.js';

class Post extends entity({ id: primary(), title: text() }) {}

const card: IdentityCard = {
  fronds: [{
    name: 'blog',
    doors: [{
      name: 'post',
      schema: Card.fromSchema(Post, 'post').descriptor,
      ops: [{ name: 'list', kind: 'query', cardinality: 'page' }],
    }],
    facts: [],
  }],
};

describe('admin runtime', () => {
  it('shares one discovery between resources and lazy provider calls', async () => {
    const methods: string[] = [];
    const urls: string[] = [];
    const fetcher: Fetcher = async <T,>(
      url: string,
      options: { method: 'POST'; body: unknown },
    ): Promise<T> => {
      const call = options.body as { id: number; method: string };
      urls.push(url);
      methods.push(call.method);
      return {
        jsonrpc: '2.0',
        id: call.id,
        result: call.method === 'rpc.discover' ? card : [{ id: '1', title: 'Hello' }],
      } as T;
    };
    const runtime = createAdminRuntime({
      endpoint: '/custom/admin-wire',
      fetcher,
      extensions: [{ resource: 'post', label: 'Articles' }],
    });

    const [first, second] = await Promise.all([runtime.load(), runtime.load()]);
    expect(first).toBe(second);
    expect(first.resources[0]?.label).toBe('Articles');

    const page = await runtime.dataProvider.getList('post', {
      pagination: { page: 1, perPage: 25 },
    });
    expect(page.data).toEqual([{ id: '1', title: 'Hello' }]);
    expect(methods).toEqual(['rpc.discover', 'post.list']);
    expect(urls).toEqual(['/custom/admin-wire', '/custom/admin-wire']);
  });
});

describe('a discovery that failed', () => {
  it('is not memoized, so a retry can succeed', async () => {
    // `loading ??= fetchCard(...)` alone caches the REJECTION: a receiver that was down
    // when the panel opened stays down for the life of the tab, because every later
    // attempt awaits the same dead promise. Nothing in the UI could recover from it.
    let attempts = 0;
    const flaky: Fetcher = async <T,>() => {
      attempts += 1;
      if (attempts === 1) throw new Error('ECONNREFUSED');
      return { jsonrpc: '2.0', id: 1, result: card } as T;
    };

    const runtime = createAdminRuntime({ fetcher: flaky });

    await expect(runtime.load()).rejects.toThrow('ECONNREFUSED');
    const loaded = await runtime.load();
    expect(loaded.resources.map((r) => r.name)).toEqual(['post']);
    expect(attempts).toBe(2);
  });

  it('still shares one request when it succeeds', async () => {
    let calls = 0;
    const counting: Fetcher = async <T,>() => {
      calls += 1;
      return { jsonrpc: '2.0', id: 1, result: card } as T;
    };
    const runtime = createAdminRuntime({ fetcher: counting });
    await Promise.all([runtime.load(), runtime.load(), runtime.load()]);
    expect(calls).toBe(1);
  });
});
