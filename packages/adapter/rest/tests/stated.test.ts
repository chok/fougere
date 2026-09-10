/**
 * A frond names its own REST route — the dual of `graphql:`, which it could already name.
 *
 * Where an operation answers belongs beside it, not in whatever host mounts the router.
 * The PREFIX stays the host's: naming is the frond's, mounting is not.
 */
import { describe, it, expect } from 'vitest';
import { generateRoutes } from '../src/routes.js';
import { entity, primary, text } from '@fougere/schema';

class Post extends entity({ id: primary(), title: text() }) {}

const app = (overrides?: Record<string, unknown>) => ({
  fronds: [{
    name: 'blog',
    entities: [{ name: 'post', entityClass: Post, filePath: '', exposed: true }],
    handlers: [],
    presenters: [],
    ...(overrides ? { operationsOverrides: overrides } : {}),
  }],
  facadeFor: () => ({ list: async () => [] }),
  operationsFor: () => new Map([['list', { kind: 'query' }]]),
}) as never;

const routeFor = (built: never, op: string) =>
  generateRoutes(built, { prefix: '/api' }).find((one) => one.operationName === op)!;

describe('a route the frond named', () => {
  it('derives the path when the frond says nothing', () => {
    expect(routeFor(app(), 'list')).toMatchObject({ method: 'GET', path: '/api/posts' });
  });

  it('takes what `rest:` states, and the host still mounts the prefix', () => {
    const stated = app({ list: { rest: { path: '/articles', status: 200 } } });

    expect(routeFor(stated, 'list')).toMatchObject({ path: '/api/articles', successStatus: 200 });
  });

  it('lets the host override what the frond named, since it is deciding for someone else', () => {
    const stated = app({ list: { rest: { path: '/articles' } } });
    const routes = generateRoutes(stated, {
      prefix: '/api',
      overrides: { post: { list: { path: '/legacy' } } },
    });

    expect(routes.find((one) => one.operationName === 'list')?.path).toBe('/api/legacy');
  });
});
