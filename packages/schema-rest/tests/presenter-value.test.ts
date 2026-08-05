import { describe, expect, it, vi } from 'vitest';
import { entity, primary, text } from '@fougere/schema';
import { generateRoutes, registerRoutes } from '../src/index.js';

/**
 * A computed field travels with the row; this projection adds nothing to it.
 *
 * The façade applies the presenter on every door (`presentEgress` in @fougere/core), so a
 * route that enriched the result again did the work twice — and outright broke once a
 * computed field started receiving the PAGE rather than one row: the second pass handed it
 * a single object and it threw `posts.map is not a function`. REST hit this on every
 * response, without a client having to ask for the field.
 */
class Post extends entity({ id: primary(), body: text() }) {}

/** Written the way presenters are written today: the page in, one value per row out. */
class PostPresenter {
  excerpt(posts: Post[]): string[] {
    return posts.map((p) => (p as { body: string }).body.slice(0, 7));
  }
}

/** The façade — it has already applied the presenter, so `excerpt` is on the row. */
function facadeWithComputedField() {
  return {
    list: vi.fn(async () => [{ id: '1', body: 'bonjour tout le monde', excerpt: 'bonjour' }]),
  };
}

function fakeApp(facade: object, presenter: object) {
  return {
    fronds: [{
      name: 'blog',
      entities: [{ name: 'post', entityClass: Post }],
      handlers: [{ entityName: 'post', operations: new Map([['list', {}]]) }],
      presenters: [{ entityName: 'post', fields: ['excerpt'] }],
    }],
    resolve: <T>(name: string) => (name === 'PostPresenter' ? presenter : facade) as T,
    facadeFor: () => facade as Record<string, Function>,
  } as never;
}

/** Drive the GET /posts route the way an HTTP adapter would, and return its body. */
async function getPosts(app: never) {
  const routes = generateRoutes(app);
  let handler!: (ctx: unknown) => Promise<{ status: number; data: unknown }>;
  const router = {
    on: (method: string, path: string, fn: never) => {
      if (method === 'GET' && path === '/posts') handler = fn;
    },
  };
  registerRoutes(router as never, routes);
  return handler({ params: {}, query: {}, state: {}, body: async () => undefined });
}

describe('a computed field reaching REST', () => {
  it('serves the value the façade already computed', async () => {
    const response = await getPosts(fakeApp(facadeWithComputedField(), new PostPresenter()));

    expect(response.data).toEqual([
      { id: '1', body: 'bonjour tout le monde', excerpt: 'bonjour' },
    ]);
  });

  it('does not call the presenter method', async () => {
    const presenter = new PostPresenter();
    const spy = vi.spyOn(presenter, 'excerpt');

    await getPosts(fakeApp(facadeWithComputedField(), presenter));
    expect(spy).not.toHaveBeenCalled();
  });
});
