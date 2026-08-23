/**
 * The catch-all used to pick an operation from its NAME and never look at the verb, so a
 * mutating op was reachable by GET — which a browser attaches the session cookie to on any
 * navigation, `<img src>` included. These tests pin the rule that replaced it: the verb
 * comes from the canonical table, the same one `schema-rest` serves.
 */
import { describe, it, expect } from 'vitest';
import { entity, primary, text } from '@fougere/schema';
import { matchRoute, tableOf, type Matchable } from '../src/rest.js';

class Post extends entity({ id: primary(), title: text() }) {}
class Secret extends entity({ id: primary(), token: text() }) {}

/** The five CRUD ops plus the two the blog frond really adds. */
const facade = {
  list: () => {},
  findById: () => {},
  create: () => {},
  update: () => {},
  delete: () => {},
  publish: () => {},
  bySlug: () => {},
};

// The scan registers an entity under its lowercase-first name (`registrationKeyOf`,
// scanner.ts:385) — which is what makes the served path `/blog/posts`, as documented.
function appOf(options: { exposed?: boolean; overrides?: Record<string, { kind?: 'query' | 'command' }> } = {}) {
  return {
    fronds: [{
      name: 'blog',
      entities: [
        { name: 'post', entityClass: Post, exposed: options.exposed },
        { name: 'secret', entityClass: Secret, exposed: false },
      ],
      handlers: [{ address: 'post', operations: new Map(), surface: undefined }],
      presenters: [],
      operationsOverrides: options.overrides,
    }],
    resolve: () => undefined as never,
    facadeFor: (name: string) => (name === 'post' || name === 'secret' ? facade : undefined),
    operationsFor: (name: string) => (name === 'post' || name === 'secret'
      ? new Map(Object.keys(facade).map((op) => [
        op,
        {
          kind: options.overrides?.[op]?.kind
            ?? (op === 'list' || op === 'findById' ? 'query' : 'command'),
        },
      ]))
      : undefined),
  } as never;
}

const table = tableOf(appOf());
const segmentsOf = (path: string) => path.split('/').filter(Boolean);
const match = (method: string, path: string) => matchRoute(table, method, segmentsOf(path));

describe('the verb decides, not the operation name', () => {
  it('refuses a mutating op reached by GET, and says which verb it wants', () => {
    const result = match('GET', 'blog/posts/publish');

    // The bug, exactly: this used to resolve to `publish` and run it.
    expect(result?.kind).toBe('method-not-allowed');
    expect(result).toMatchObject({ allow: ['POST'] });
  });

  it('serves the same op under its own verb', () => {
    expect(match('POST', 'blog/posts/publish')).toMatchObject({
      kind: 'match',
      route: { entityName: 'post', operationName: 'publish' },
    });
  });

  it('does not read a verb-less collection request as a create', () => {
    // `DELETE /posts` used to mean `create` — the fallback of a rule that only knew GET.
    expect(match('DELETE', 'blog/posts')).toMatchObject({ kind: 'method-not-allowed' });
    expect(match('POST', 'blog/posts')).toMatchObject({ kind: 'match', route: { operationName: 'create' } });
    expect(match('GET', 'blog/posts')).toMatchObject({ kind: 'match', route: { operationName: 'list' } });
  });

  it('still routes the ordinary CRUD verbs on a row', () => {
    expect(match('GET', 'blog/posts/abc')).toMatchObject({ kind: 'match', route: { operationName: 'findById' } });
    expect(match('PUT', 'blog/posts/abc')).toMatchObject({ kind: 'match', route: { operationName: 'update' } });
    expect(match('DELETE', 'blog/posts/abc')).toMatchObject({ kind: 'match', route: { operationName: 'delete' } });
  });

  it('captures the row id from the path', () => {
    expect(match('GET', 'blog/posts/abc')).toMatchObject({ params: { id: 'abc' } });
    // A URL-encoded key is a key, not two segments.
    expect(match('GET', 'blog/posts/a%2Fb')).toMatchObject({ params: { id: 'a/b' } });
  });
});

describe('what the table does not serve', () => {
  it('lets a path it does not know through, so the app keeps its own /api routes', () => {
    expect(match('GET', 'newsletter/subscribe')).toBeNull();
    expect(match('GET', 'blog/comments')).toBeNull();
  });

  it('drops an entity the frond did not expose', () => {
    // `exposed === false` is honoured by `generateRoutes`; this door never applied it.
    expect(match('GET', 'blog/secrets')).toBeNull();
    expect(match('DELETE', 'blog/secrets/abc')).toBeNull();
  });
});

describe('a literal path wins over a parameter', () => {
  it('answers 405 rather than treating the op name as an id', () => {
    // Both `/posts/publish` and `/posts/:id` accept these segments. The specific one
    // wins, so the answer names the verb instead of silently doing something else.
    const result = match('GET', 'blog/posts/publish');
    expect(result).not.toMatchObject({ route: { operationName: 'findById' } });
  });
});

describe('frond.config.ts still decides an op kind', () => {
  it('honours `kind: query`, which is what makes a read reachable by GET', () => {
    // `bySlug` matches no read prefix, so the convention makes it a POST. Stating the
    // kind is the sanctioned way back to GET — and it goes through `deriveMethod`,
    // never through a second rule written here.
    const stated = tableOf(appOf({ overrides: { bySlug: { kind: 'query' } } }));

    expect(matchRoute(stated, 'GET', segmentsOf('blog/posts/by-slug')))
      .toMatchObject({ kind: 'match', route: { operationName: 'bySlug' } });
  });

  it('leaves an unstated custom op on the safe side of the convention', () => {
    const t: Matchable[] = table.filter((r) => r.operationName === 'bySlug');
    expect(t.map((r) => r.method)).toEqual(['POST']);
  });
});

describe('the verbs this door promised', () => {
  it('keeps PATCH on update, which the table spells PUT', () => {
    // Documented as `PUT · PATCH` in docs/infra/surfaces. The table gives `update` one
    // verb; the alias keeps the promise without inventing a second route.
    expect(match('PATCH', 'blog/posts/abc')).toMatchObject({
      kind: 'match',
      route: { operationName: 'update' },
    });
  });

  it('does not let an alias reach a verb the table never gave', () => {
    expect(match('PATCH', 'blog/posts')).toMatchObject({ kind: 'method-not-allowed' });
  });
});
