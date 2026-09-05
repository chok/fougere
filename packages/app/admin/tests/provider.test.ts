import { describe, expect, it } from 'vitest';
import type { Fetcher } from '@fougere/app/client';
import { createDataProvider } from '../src/provider.js';

interface SentCall {
  method: string;
  params: {
    params: Record<string, unknown>;
    query: Record<string, unknown>;
    input?: Record<string, unknown>;
  };
}

function resultFetcher(
  answer: (call: SentCall) => unknown,
  sent: SentCall[],
): Fetcher {
  return async <T,>(_url: string, options: { method: 'POST'; body: unknown }): Promise<T> => {
    const call = options.body as SentCall & { id: number };
    sent.push(call);
    return { jsonrpc: '2.0', id: call.id, result: answer(call) } as T;
  };
}

describe('the Fougere data provider', () => {
  it('maps partial pagination, sorting and filters onto list query options', async () => {
    const sent: SentCall[] = [];
    const provider = createDataProvider({
      resources: { post: { name: 'post', primary: 'slug' } },
      fetcher: resultFetcher(() => [
        { slug: 'a', title: 'A' },
        { slug: 'b', title: 'B' },
        { slug: 'c', title: 'C' },
      ], sent),
    });

    const page = await provider.getList('post', {
      pagination: { page: 2, perPage: 2 },
      sort: { field: 'title', order: 'DESC' },
      filter: { status: 'draft' },
    });

    expect(sent[0]).toMatchObject({
      method: 'post.list',
      params: {
        query: {
          limit: 3,
          offset: 2,
          count: true,
          orderBy: 'title',
          order: 'desc',
          where: { status: 'draft' },
        },
      },
    });
    expect(page.data).toEqual([
      { slug: 'a', id: 'a', title: 'A' },
      { slug: 'b', id: 'b', title: 'B' },
    ]);
    expect(page.pageInfo).toEqual({ hasNextPage: true, hasPreviousPage: true });
  });

  it('translates react-admin id back to the entity primary field on writes', async () => {
    const sent: SentCall[] = [];
    const provider = createDataProvider({
      resources: { post: { name: 'post', primary: 'slug' } },
      fetcher: resultFetcher((call) => ({ ...call.params.input }), sent),
    });

    const updated = await provider.update('post', {
      id: 'hello',
      data: { id: 'hello', title: 'Hello again' },
    });

    expect(sent[0]).toMatchObject({
      method: 'post.update',
      params: {
        params: { id: 'hello' },
        input: { slug: 'hello', title: 'Hello again' },
      },
    });
    expect(updated.data).toMatchObject({ id: 'hello', slug: 'hello' });
  });

  it('turns judge refusals into field errors react-admin forms understand', async () => {
    const fetcher: Fetcher = async <T,>(
      _url: string,
      options: { method: 'POST'; body: unknown },
    ): Promise<T> => {
      const call = options.body as { id: number };
      return {
        jsonrpc: '2.0',
        id: call.id,
        error: {
          code: -32000,
          message: 'Validation failed',
          data: {
            code: 'VALIDATION_FAILED',
            message: 'title: Too short',
            entity: 'post',
            operation: 'create',
            details: [{ path: 'title', message: 'Too short' }],
          },
        },
      } as T;
    };
    const provider = createDataProvider({
      resources: { post: { name: 'post', primary: 'id' } },
      fetcher,
    });

    await expect(provider.create('post', { data: { title: '' } })).rejects.toMatchObject({
      status: 400,
      body: { errors: { title: 'Too short' } },
    });
  });

  it('refuses a resource the live card did not name', async () => {
    const provider = createDataProvider({ resources: {} });
    await expect(provider.getOne('ghost', { id: '1' })).rejects.toThrow(/Unknown resource 'ghost'/);
  });
});

describe('a business operation', () => {
  it('reaches its own op, with the row id where the CRUD convention puts it', async () => {
    // The nine react-admin verbs describe a resource; `publish` describes an action, so
    // none of them can carry it. Before this door existed, an op the card ANNOUNCED —
    // with a label and a confirmation sentence — was unreachable from the panel.
    const sent: SentCall[] = [];
    const provider = createDataProvider({
      resources: { post: { name: 'post', primary: 'id' } },
      fetcher: resultFetcher(() => ({ id: 'p1', status: 'published' }), sent),
    });

    const answer = await provider.invoke('post', { op: 'publish', id: 'p1' });

    expect(sent[0]).toMatchObject({ method: 'post.publish', params: { params: { id: 'p1' } } });
    expect(answer.data).toEqual({ id: 'p1', status: 'published' });
  });

  it('sends its input, and sends none when the op takes none', async () => {
    const sent: SentCall[] = [];
    const provider = createDataProvider({
      resources: { post: { name: 'post', primary: 'id' } },
      fetcher: resultFetcher(() => true, sent),
    });

    await provider.invoke('post', { op: 'schedule', id: 'p1', data: { when: '2026-09-01' } });
    await provider.invoke('post', { op: 'archiveAll' });

    expect(sent[0]!.params.input).toEqual({ when: '2026-09-01' });
    expect(sent[1]!.params.input).toBeUndefined();
    expect(sent[1]!.params.params).toEqual({});
  });
});
