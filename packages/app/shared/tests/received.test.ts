/**
 * What a page receives, read back through the schema the card carries.
 *
 * `date-time` means a `Date` on both sides, and the browser held the string: three pages of this
 * repo wrote `day(iso?: string)` and called `new Date(iso)` by hand, against the type their
 * composable handed them. A server-side caller has the schema by construction; a browser asks.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { created, entity, primary, text, Card } from '@fougere/schema';
import { sendCall } from '../src/Designation.js';
import type { Fetcher } from '../src/Fetcher.js';

class Post extends entity({ id: primary(), title: text(), publishedAt: created() }) {}

const card = {
  app: 'test',
  fronds: [{
    name: 'blog',
    facades: [{ name: 'post', ops: [], schema: Card.fromSchema(Post).descriptor }],
    facts: [],
  }],
};

const row = { id: 'p1', title: 'Hello', publishedAt: '1970-01-01T00:00:00.000Z' };

function watching(answers: Record<string, unknown>): { fetcher: Fetcher; asked: string[] } {
  const asked: string[] = [];

  return {
    asked,
    fetcher: async <T,>(_url: string, options: { method: 'POST'; body: unknown }): Promise<T> => {
      const call = options.body as { id: number; method: string };
      asked.push(call.method);

      return { jsonrpc: '2.0', id: call.id, result: answers[call.method] } as T;
    },
  };
}

describe('a page receives what its type promises', () => {
  // The cache lives per endpoint, so each case asks at one of its own.
  let nth = 0;
  beforeEach(() => { nth += 1; });

  it('reads a row back through the schema — the string becomes a Date', async () => {
    const { fetcher } = watching({ 'rpc.discover': card, 'post.findById': row });

    const post = await sendCall(fetcher, { entity: 'post', op: 'findById' },
      { params: {}, query: {}, input: undefined, state: {} }, `/a${nth}`) as { publishedAt: unknown };

    expect(post.publishedAt).toBeInstanceOf(Date);
    expect((post.publishedAt as Date).toISOString()).toBe('1970-01-01T00:00:00.000Z');
  });

  it('walks the rows of a page, and asks for the card once', async () => {
    const { fetcher, asked } = watching({ 'rpc.discover': card, 'post.list': { items: [row, row], total: 2 } });
    const at = `/b${nth}`;
    const call = { params: {}, query: {}, input: undefined, state: {} };

    const first = await sendCall(fetcher, { entity: 'post', op: 'list' }, call, at) as { items: { publishedAt: unknown }[] };
    await sendCall(fetcher, { entity: 'post', op: 'list' }, call, at);

    expect(first.items.every((one) => one.publishedAt instanceof Date)).toBe(true);
    expect(asked.filter((method) => method === 'rpc.discover')).toHaveLength(1);
  });

  it('learns from a card that went past, so an app already asking pays for one discovery', async () => {
    const { fetcher, asked } = watching({ 'rpc.discover': card, 'post.findById': row });
    const at = `/c${nth}`;
    const call = { params: {}, query: {}, input: undefined, state: {} };

    await sendCall(fetcher, { entity: 'rpc', op: 'discover' }, call, at);
    const post = await sendCall(fetcher, { entity: 'post', op: 'findById' }, call, at) as { publishedAt: unknown };

    expect(post.publishedAt).toBeInstanceOf(Date);
    expect(asked).toEqual(['rpc.discover', 'post.findById']);
  });

  it('hands over what arrived when the app publishes no card', async () => {
    const { fetcher } = watching({ 'rpc.discover': { nope: true }, 'post.findById': row });

    const post = await sendCall(fetcher, { entity: 'post', op: 'findById' },
      { params: {}, query: {}, input: undefined, state: {} }, `/d${nth}`) as { publishedAt: unknown };

    expect(post.publishedAt).toBe('1970-01-01T00:00:00.000Z');
  });
});
