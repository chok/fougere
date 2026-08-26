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

/** Build an OperationsMap from op names + optional ops with meta. */
function opsMap(
  ops: string[],
  custom?: Record<string, { input?: any; output?: any }>,
): Map<string, any> {
  const map = new Map<string, any>();
  for (const op of ops) map.set(op, { kind: operationKinds[op] });
  if (custom) {
    for (const [name, meta] of Object.entries(custom)) {
      map.set(name, { kind: operationKinds[name], ...meta });
    }
  }
  return map;
}

function fakeApp(
  entities: { name: string; entityClass: any }[],
  facades: Record<string, any>,
  handlers: any[] = [],
  surfaces?: Record<string, string[]>,
) {
  return {
    // `presenters` was missing: the real scanner always answers an array, empty when
    // a frond declares none. Omitting it made this stand-in a shape the source never
    // produces — no test here exercises presenters, so the empty list is the truth.
    fronds: [{ name: 'test', entities, handlers, presenters: [], surfaces }],
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
        { kind: operationKinds[name], ...handler?.operations.get(name) },
      ]));
    },
  };
}

// ─── Tests ─────────────────────────────────────

describe('generateRoutes', () => {
  it('refuses a facade with no canonical operation table', () => {
    const app = fakeApp(
      [{ name: 'post', entityClass: Post }],
      { postHandler: fakeCrud() },
    );

    expect(() => generateRoutes({ ...app, operationsFor: () => undefined }))
      .toThrow(/without its EffectiveOperation table/);
  });

  it('generates CRUD routes for all entities', () => {
    const app = fakeApp(
      [{ name: 'post', entityClass: Post }],
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
      [{ name: 'post', entityClass: Post }],
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
      [{ name: 'post', entityClass: Post }],
      { postHandler: fakeCrud() },
    );

    const routes = generateRoutes(app, { prefix: '/api' });

    expect(routes[0].path).toBe('/api/posts');
    expect(routes[1].path).toBe('/api/posts/:id');
  });

  it('pluralizes entity names correctly', () => {
    const app = fakeApp(
      [
        { name: 'post', entityClass: Post },
        { name: 'category', entityClass: Post },
      ],
      { postHandler: fakeCrud(), categoryHandler: fakeCrud() },
    );

    const routes = generateRoutes(app);
    const paths = routes.map((r) => r.path);

    expect(paths).toContain('/posts');
    expect(paths).toContain('/categories');
  });

  it('generates routes for all operations', () => {
    const app = fakeApp(
      [{ name: 'post', entityClass: Post }],
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

  it('custom ById operations get :id in path', () => {
    const app = fakeApp(
      [{ name: 'post', entityClass: Post }],
      { postHandler: { ...fakeCrud(), archiveById: vi.fn(async () => ({})) } },
      [{
        address: 'post',
        operations: opsMap(['list'], { archiveById: { input: Post.pick('id') } }),
      }],
    );

    const routes = generateRoutes(app);
    const archive = routes.find((r) => r.operationName === 'archiveById');

    expect(archive?.method).toBe('POST');
    expect(archive?.path).toBe('/posts/:id/archive');
  });

  it('supports route overrides', () => {
    const app = fakeApp(
      [{ name: 'post', entityClass: Post }],
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
      [{ name: 'post', entityClass: Post }],
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

  it('skips entities without handler facade', () => {
    const app = fakeApp(
      [
        { name: 'post', entityClass: Post },
        { name: 'author', entityClass: Author },
      ],
      { postHandler: fakeCrud() },
    );

    const routes = generateRoutes(app);
    const entities = [...new Set(routes.map((r) => r.entityName))];
    expect(entities).toEqual(['post']);
  });

  it('filter option works', () => {
    const app = fakeApp(
      [
        { name: 'post', entityClass: Post },
        { name: 'author', entityClass: Author },
      ],
      { postHandler: fakeCrud(), authorHandler: fakeCrud() },
    );

    const routes = generateRoutes(app, {
      filter: (e) => e.name === 'post',
    });

    const entities = [...new Set(routes.map((r) => r.entityName))];
    expect(entities).toEqual(['post']);
  });

  it('surface config filters entities for this surface', () => {
    const app = fakeApp(
      [
        { name: 'post', entityClass: Post },
        { name: 'author', entityClass: Author },
      ],
      { postHandler: fakeCrud(), authorHandler: fakeCrud() },
      [],
      { rest: ['Post'] },
    );

    const routes = generateRoutes(app, { surface: 'rest' });
    const entities = [...new Set(routes.map((r) => r.entityName))];
    expect(entities).toEqual(['post']);
  });

  it('without surface option, surfaces config is ignored', () => {
    const app = fakeApp(
      [
        { name: 'post', entityClass: Post },
        { name: 'author', entityClass: Author },
      ],
      { postHandler: fakeCrud(), authorHandler: fakeCrud() },
      [],
      { rest: ['Post'] },
    );

    const routes = generateRoutes(app);
    const entities = [...new Set(routes.map((r) => r.entityName))];
    expect(entities).toContain('post');
    expect(entities).toContain('author');
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
      [{ name: 'account', entityClass: Account }],
      { accountHandler: fakeCrud() },
      [{ address: 'account', operations: opsMap(['list', 'create']) }],
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
      [{ name: 'post', entityClass: Post }],
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
