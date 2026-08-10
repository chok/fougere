/**
 * The doors' decisions, pinned once for every host.
 *
 * These used to be spread across two h3 handlers; a second adapter would have made
 * them a third copy, and the copies in this repo have a history of drifting apart.
 * What is tested here is what Nuxt and Next both do WITHOUT restating it: the
 * audience a path selects, what "not ours" looks like, which verbs a path accepts,
 * and what an operation's return becomes on the wire.
 *
 * Dispatch itself is not here on purpose — `shapeRest` is separate from `serveRest`
 * precisely so the shaping can be judged without standing up a runner.
 */
import { describe, it, expect } from 'vitest';
import { entity, primary, text } from '@fougere/schema';
import { serveRest, shapeRest, surfaceOf } from '../src/serve.js';

class Post extends entity({ id: primary(), title: text() }) {}

const facade = {
  list: () => [],
  findById: () => null,
  create: () => ({}),
  update: () => ({}),
  delete: () => true,
};

function appOf() {
  return {
    fronds: [{
      name: 'blog',
      entities: [{ name: 'post', entityClass: Post }],
      handlers: [{ address: 'post', operations: new Map(), surface: undefined }],
      presenters: [],
    }],
    resolve: () => undefined as never,
    facadeFor: (name: string) => (name === 'post' ? facade : undefined),
  } as never;
}

const app = appOf();
const request = (method: string, path: string) =>
  serveRest(app, { method, path, query: {}, state: {} });

describe('surfaceOf', () => {
  it('names no audience on the bare door', () => {
    expect(surfaceOf('/_fougere/call')).toBeUndefined();
  });

  it('takes the audience from the segment after the door', () => {
    expect(surfaceOf('/_fougere/call/public')).toBe('public');
  });

  it('ignores a query string — the audience is a path segment, not a parameter', () => {
    expect(surfaceOf('/_fougere/call/public?trace=1')).toBe('public');
  });
});

describe('serveRest — what it declines', () => {
  it('passes on a path too short to name an entity, so the app keeps its own /api routes', async () => {
    expect(await request('GET', 'health')).toEqual({ kind: 'pass' });
  });

  it('passes on a path no frond serves', async () => {
    expect(await request('GET', 'blog/nope')).toEqual({ kind: 'pass' });
  });

  it('refuses a verb the table does not serve, and says which ones it does', async () => {
    expect(await request('DELETE', 'blog/posts')).toMatchObject({
      kind: 'error',
      status: 405,
      body: { allow: ['GET', 'POST'] },
      headers: { allow: 'GET, POST' },
    });
  });
});

describe('shapeRest', () => {
  it('shapes a list as an envelope, so the page facts survive JSON', () => {
    const page = [{ id: 'a' }, { id: 'b' }] as unknown as { total?: number; hasMore?: boolean; endCursor?: string } & { id: string }[];
    page.total = 7;
    page.hasMore = true;
    page.endCursor = 'b';

    expect(shapeRest('list', page)).toEqual({
      kind: 'ok',
      status: 200,
      body: { items: [{ id: 'a' }, { id: 'b' }], total: 7, hasMore: true, endCursor: 'b' },
    });
  });

  it('leaves a non-list result alone', () => {
    expect(shapeRest('findById', { id: 'a' })).toEqual({ kind: 'ok', status: 200, body: { id: 'a' } });
  });

  it('does not envelope an array that is not a list result', () => {
    expect(shapeRest('drafts', [{ id: 'a' }])).toEqual({ kind: 'ok', status: 200, body: [{ id: 'a' }] });
  });

  it('turns a missing row into 404 rather than a null body', () => {
    expect(shapeRest('findById', null)).toEqual({ kind: 'error', status: 404, body: { message: 'Not found' } });
  });
});
