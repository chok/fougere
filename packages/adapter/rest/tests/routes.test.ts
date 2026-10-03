import { describe, it, expect, vi } from 'vitest';
import { entity, primary, text, number, created, readOnly, writeOnly } from '@fougere/schema';
import { generateRoutes } from '../src/index.js';

// ─── Fixtures ──────────────────────────────────

class Post extends entity({
  id: primary(),
  title: text({ min: 1 }),
  views: number({ integer: true }),
  createdAt: created(),
}) {}

class Author extends entity({
  id: primary(),
  name: text({ min: 1 }),
  email: text(),
}) {}

function fakeCrud() {
  return {
    list: vi.fn(async () => []),
    findById: vi.fn(async () => undefined),
    create: vi.fn(async (input: any) => ({ id: '1', ...input })),
    update: vi.fn(async (id: string, input: any) => ({ id, ...input })),
    delete: vi.fn(async () => true),
  };
}

const operationKinds: Record<string, 'query' | 'command'> = {
  list: 'query',
  findById: 'query',
  searchByTitle: 'query',
  create: 'command',
  update: 'command',
  delete: 'command',
  publish: 'command',
  archiveById: 'command',
};

const designating = { name: 'id', source: { kind: 'param', name: 'id', identifies: 'Post' }, optional: false };
const body = { name: 'input', source: { kind: 'input' }, optional: false };

/** What `Crud` declares for the three ops that act on one row. */
const bindings: Record<string, unknown[]> = {
  findById: [designating],
  update: [designating, body],
  delete: [designating],
};

/** Build an OperationsMap from op names + optional ops with meta. */
function opsMap(
  ops: string[],
  custom?: Record<string, { input?: any; output?: any }>,
): Map<string, any> {
  const map = new Map<string, any>();
  for (const op of ops) map.set(op, { kind: operationKinds[op], binding: bindings[op] });
  if (custom) {
    for (const [name, meta] of Object.entries(custom)) {
      map.set(name, { kind: operationKinds[name], ...meta });
    }
  }

  return map;
}

function fakeApp(
  facades: Record<string, any>,
  handlers: any[] = [],
  surfaces?: Record<string, string[]>,
) {
  // What serves is what a real app lists: one handler per façade key, `<surface>:<address>Handler`.
  const served = Object.keys(facades).map((key) => {
    const [, surface, address] = /^(?:(\w+):)?(\w+)Handler$/.exec(key)!;

    return handlers.find((one) => one.address === address && one.surface === surface)
      ?? { address, ...(surface ? { surface } : {}) };
  });

  return {
    // `presenters` was missing: the real scanner always answers an array, empty when
    // a frond declares none. Omitting it made this stand-in a shape the source never
    // produces — no test here exercises presenters, so the empty list is the truth.
    fronds: [{ name: 'test', handlers: served, presenters: [], surfaces }],
    resolve: <T>(name: string) => facades[name] as unknown as T,
    // Mirrors App.facadeFor (bootstrap.ts): naming an audience closes it —
    // the `surfaces:` list when it exists, else a façade under the surface key.
    facadeFor: (entity: string, surface?: string) => {
      if (!surface) return facades[`${entity}Handler`];
      const own = facades[`${surface}:${entity}Handler`];
      const declared = surfaces?.[surface];
      if (!declared) return own;

      return declared.some((n) => n.toLowerCase() === entity.toLowerCase())
        ? (own ?? facades[`${entity}Handler`])
        : undefined;
    },
    operationsFor: (entity: string, surface?: string) => {
      const handler = handlers.find((candidate) =>
        candidate.address === entity && (!surface || candidate.surface === surface));
      const facade = facades[`${surface ? `${surface}:` : ''}${entity}Handler`]
        ?? facades[`${entity}Handler`];
      if (!facade) return undefined;

      return new Map(Object.keys(facade).map((name) => [
        name,
        { kind: operationKinds[name], binding: bindings[name], ...handler?.operations.get(name) },
      ]));
    },
  };
}

// ─── Tests ─────────────────────────────────────

describe('generateRoutes', () => {
  it('refuses a facade with no canonical operation table', () => {
    const app = fakeApp(
      { postHandler: fakeCrud() },
    );

    expect(() => generateRoutes({ ...app, operationsFor: () => undefined }))
      .toThrow(/without its EffectiveOperation table/);
  });

  it('generates CRUD routes for every address', () => {
    const app = fakeApp(
      { postHandler: fakeCrud() },
      [{ address: 'post', operations: opsMap(['list', 'findById', 'create', 'update', 'delete']) }],
    );

    const routes = generateRoutes(app);

    expect(routes).toHaveLength(5);
    expect(routes.map((r) => `${r.method} ${r.path}`)).toEqual([
      'GET /posts',
      'GET /posts/:id',
      'POST /posts',
      'PUT /posts/:id',
      'DELETE /posts/:id',
    ]);
  });

  it('respects handler operations whitelist', () => {
    // Facade only has read ops — bootstrap enforces the whitelist
    const crud = fakeCrud();
    const app = fakeApp(
      { postHandler: { list: crud.list, findById: crud.findById } },
      [{ address: 'post', operations: opsMap(['list', 'findById']) }],
    );

    const routes = generateRoutes(app);

    expect(routes).toHaveLength(2);
    expect(routes.map((r) => `${r.method} ${r.path}`)).toEqual([
      'GET /posts',
      'GET /posts/:id',
    ]);
  });

  it('applies prefix', () => {
    const app = fakeApp(
      { postHandler: fakeCrud() },
    );

    const routes = generateRoutes(app, { prefix: '/api' });

    expect(routes[0].path).toBe('/api/posts');
    expect(routes[1].path).toBe('/api/posts/:id');
  });

  it('pluralizes addresses', () => {
    const app = fakeApp(
      { postHandler: fakeCrud(), categoryHandler: fakeCrud() },
    );

    const routes = generateRoutes(app);
    const paths = routes.map((r) => r.path);

    expect(paths).toContain('/posts');
    expect(paths).toContain('/categories');
  });

  it('generates routes for all operations', () => {
    const app = fakeApp(
      {
        postHandler: {
          ...fakeCrud(),
          searchByTitle: vi.fn(async () => []),
          publish: vi.fn(async () => ({})),
        },
      },
      [{
        address: 'post',
        operations: opsMap(
          ['list', 'findById', 'create', 'update', 'delete'],
          {
            searchByTitle: { input: Post.pick('title'), output: Post.pick('id', 'title') },
            publish: { input: Post.pick('id'), output: Post },
          },
        ),
      }],
    );

    const routes = generateRoutes(app);
    const custom = routes.filter((r) => !['list', 'findById', 'create', 'update', 'delete'].includes(r.operationName));

    expect(custom).toHaveLength(2);
    expect(custom.map((r) => `${r.method} ${r.path}`)).toEqual([
      'GET /posts/search-by-title',
      'POST /posts/publish',
    ]);
  });

  it('reads the path off the signature, never off the name', () => {
    const param = (name: string, extra: object = {}) =>
      ({ name, source: { kind: 'param', name, ...extra }, optional: false });
    const ops = {
      publish: [param('id', { identifies: 'Post' })],
      move: [param('id', { identifies: 'Post' }), param('position', { coerce: 'number' })],
      byTag: [param('tag')],
      search: [{ ...param('term'), optional: true }],
      archiveById: [param('id')],
    };
    const facade = Object.fromEntries(Object.keys(ops).map((name) => [name, vi.fn(async () => ({}))]));
    const app = fakeApp(
      { postHandler: facade },
      [{
        address: 'post',
        operations: new Map(Object.entries(ops).map(([name, binding]) => [name, { kind: 'command', binding }])),
      }],
    );

    expect(generateRoutes(app).map((r) => r.path)).toEqual([
      '/posts/:id/publish',
      '/posts/:id/move/:position',
      '/posts/by-tag/:tag',
      '/posts/search',
      '/posts/archive-by-id/:id',
    ]);
  });

  it('supports route overrides', () => {
    const app = fakeApp(
      { postHandler: { ...fakeCrud(), publish: vi.fn(async () => ({})) } },
      [{
        address: 'post',
        operations: opsMap(['list', 'findById'], { publish: { input: Post.pick('id') } }),
      }],
    );

    const routes = generateRoutes(app, {
      overrides: {
        post: {
          publish: { method: 'PUT', path: '/posts/:id/publish' },
        },
      },
    });

    const publish = routes.find((r) => r.operationName === 'publish');
    expect(publish?.method).toBe('PUT');
    expect(publish?.path).toBe('/posts/:id/publish');
  });

  it('route handler forwards InvocationContext to facade', async () => {
    const crud = fakeCrud();
    const app = fakeApp(
      { postHandler: crud },
      [{ address: 'post', operations: opsMap(['list', 'findById', 'create', 'update', 'delete']) }],
    );

    const routes = generateRoutes(app);

    const createRoute = routes.find((r) => r.operationName === 'create')!;
    const invocation = { params: {}, query: {}, body: { title: 'Hello', views: 42 }, state: {} };
    await createRoute.handler(invocation);
    expect(crud.create).toHaveBeenCalledWith(invocation);

    const findRoute = routes.find((r) => r.operationName === 'findById')!;
    const findInvocation = { params: { id: 'abc' }, query: {}, body: undefined, state: {} };
    await findRoute.handler(findInvocation);
    expect(crud.findById).toHaveBeenCalledWith(findInvocation);

    const updateRoute = routes.find((r) => r.operationName === 'update')!;
    const updateInvocation = { params: { id: 'abc' }, query: {}, body: { title: 'Updated' }, state: {} };
    await updateRoute.handler(updateInvocation);
    expect(crud.update).toHaveBeenCalledWith(updateInvocation);
  });

  it('skips an address with no facade', () => {
    const app = fakeApp(
      { postHandler: fakeCrud() },
    );

    const routes = generateRoutes(app);
    const addresses = [...new Set(routes.map((r) => r.address))];
    expect(addresses).toEqual(['post']);
  });

  it('filter option works', () => {
    const app = fakeApp(
      { postHandler: fakeCrud(), authorHandler: fakeCrud() },
    );

    const routes = generateRoutes(app, {
      filter: (address) => address === 'post',
    });

    const addresses = [...new Set(routes.map((r) => r.address))];
    expect(addresses).toEqual(['post']);
  });

  it('surface config filters addresses for this surface', () => {
    const app = fakeApp(
      { postHandler: fakeCrud(), authorHandler: fakeCrud() },
      [],
      { rest: ['Post'] },
    );

    const routes = generateRoutes(app, { surface: 'rest' });
    const addresses = [...new Set(routes.map((r) => r.address))];
    expect(addresses).toEqual(['post']);
  });

  it('without surface option, surfaces config is ignored', () => {
    const app = fakeApp(
      { postHandler: fakeCrud(), authorHandler: fakeCrud() },
      [],
      { rest: ['Post'] },
    );

    const routes = generateRoutes(app);
    const addresses = [...new Set(routes.map((r) => r.address))];
    expect(addresses).toContain('post');
    expect(addresses).toContain('author');
  });
});

describe('a route per address, never per entity', () => {
  it('serves a handler that names no entity', () => {
    const app = fakeApp(
      { checkoutHandler: { pay: vi.fn(async () => ({ reference: 'ch_1' })) } },
      [{ address: 'checkout', operations: new Map([['pay', { kind: 'command' }]]) }],
    );

    expect(generateRoutes(app).map((r) => `${r.method} ${r.path}`)).toEqual(['POST /checkouts/pay']);
  });

  it('serves a handler at an address other than the entity it answers', () => {
    const app = fakeApp(
      { articleHandler: { list: vi.fn(async () => []) } },
      [{ address: 'article', operations: opsMap([], { list: { output: Post } }) }],
    );
    const [list] = generateRoutes(app);

    expect(`${list!.method} ${list!.path}`).toBe('GET /articles');
    expect(Object.keys(list!.outputFields!)).toEqual(['id', 'title', 'views', 'createdAt']);
  });
});

describe("boundary 'closed' → route field membership", () => {
  class Account extends entity({
    id: primary(),
    name: text({ min: 1 }),
    password: writeOnly(text({ min: 8 })),
    loginCount: readOnly(number({ integer: true })),
  }) {}

  it('write-only is absent from outputFields, read-only absent from inputFields', () => {
    const app = fakeApp(
      { accountHandler: fakeCrud() },
      [{ address: 'account', operations: opsMap([], { list: { output: Account }, create: { input: Account, output: Account } }) }],
    );

    const routes = generateRoutes(app);
    const create = routes.find((r) => r.method === 'POST')!;
    expect(Object.keys(create.inputFields!)).toEqual(['name', 'password']); // no loginCount
    expect(Object.keys(create.outputFields!)).toEqual(['id', 'name', 'loginCount']); // no password

    const list = routes.find((r) => r.method === 'GET')!;
    expect(Object.keys(list.outputFields!)).toEqual(['id', 'name', 'loginCount']);
  });
});

describe('the operation in words', () => {
  it('carries the method\'s own doc sentence onto its route', () => {
    // The sentence reaches this projection already — `handler.operations` is core's
    // Map<string, OperationContract>. It was simply dropped here, so every generated
    // route was undocumented and no OpenAPI could be produced from them.
    const app = fakeApp(
      { postHandler: { ...fakeCrud(), publish: async () => ({}) } },
      [{
        address: 'post',
        operations: opsMap(['list', 'publish'], {
          publish: { description: 'Make a draft visible to everyone.' } as never,
        }),
      }],
    );

    const routes = generateRoutes(app);

    expect(routes.find((r) => r.operationName === 'publish')?.description)
      .toBe('Make a draft visible to everyone.');
    // An op with no sentence carries none — absent, not an empty string.
    expect(routes.find((r) => r.operationName === 'list')).not.toHaveProperty('description');
  });
});
