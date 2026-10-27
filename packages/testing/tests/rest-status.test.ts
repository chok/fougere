/**
 * REST is served by two edges: `registerRoutes` on an `HttpRouter` (Express, Fastify, Hono) and
 * `answer` behind the web hosts (Nuxt, Next, Vite). They used to decide a status apart — 201
 * against 200, 204 against 200, two 404 bodies — and now both answer through `answer`.
 */
import { afterAll, describe, expect, it } from 'vitest';
import { join } from 'node:path';
import { generateRoutes, registerRoutes } from '@fougere/adapter-rest';
import { answered } from './web.js';
import { testApp } from '../src/index.js';

const app = await testApp({ root: join(import.meta.dirname, 'fixtures'), fronds: ['press'] });
afterAll(() => app.dispose());

type HttpRouter = Parameters<typeof registerRoutes>[0];
type Handler = Parameters<HttpRouter['on']>[2];

const routes = generateRoutes(app);
const mounted: { method: string; path: string; handler: Handler }[] = [];
const router: HttpRouter = {
  use: () => {},
  on: (method, path, handler) => { mounted.push({ method, path, handler }); },
};
registerRoutes(router, routes);

interface Answered { status: number; body: unknown }

type Call = { id?: string; input?: Record<string, unknown> };

const routeOf = (op: string) => routes.find((one) => one.address === 'article' && one.operationName === op)!;
const pathOf = (op: string, call: Call) => routeOf(op).path.replace(':id', call.id ?? '');

async function viaRouter(op: string, call: Call = {}): Promise<Answered> {
  const route = routeOf(op);
  const path = pathOf(op, call);
  const { handler } = mounted.find((one) => one.method === route.method && one.path === route.path)!;
  const answer = await handler({
    request: new Request(`http://localhost${path}`, { method: route.method }),
    method: route.method,
    path,
    params: call.id === undefined ? {} : { id: call.id },
    query: {},
    body: async () => call.input,
    state: {},
  });

  return { status: answer.status, body: answer.data };
}

async function viaWeb(op: string, call: Call = {}): Promise<Answered> {
  const answer = await answered(app, routeOf(op).method, pathOf(op, call), { body: call.input });
  if (!answer) throw new Error(`REST answered nothing on ${op}`);

  return { status: answer.status, body: answer.body };
}

/** One op through both edges, for an op that leaves the rows as they were. */
async function bothEdges(op: string, call: Call = {}): Promise<{ router: Answered; web: Answered }> {
  return { router: await viaRouter(op, call), web: await viaWeb(op, call) };
}

const article = { title: 'Two edges', body: 'One op', status: 'draft', views: 1 };
const created = async () => (await viaRouter('create', { input: article })).body as { id: string };

describe('the two REST edges agree', () => {
  it('on list', async () => {
    const { router, web } = await bothEdges('list');
    expect([router.status, web.status]).toEqual([200, 200]);
  });

  it('on findById, for a row that exists', async () => {
    const { id } = await created();
    const { router, web } = await bothEdges('findById', { id });
    expect([router.status, web.status]).toEqual([200, 200]);
    expect(JSON.parse(JSON.stringify(web.body))).toEqual(JSON.parse(JSON.stringify(router.body)));
  });

  it('on update', async () => {
    const router = await viaRouter('update', { id: (await created()).id, input: { title: 'Retitled' } });
    const web = await viaWeb('update', { id: (await created()).id, input: { title: 'Retitled' } });
    expect([router.status, web.status]).toEqual([200, 200]);
  });

  it('on a refused input', async () => {
    const { router, web } = await bothEdges('create', { input: { ...article, title: 'x' } });
    expect([router.status, web.status]).toEqual([400, 400]);
    expect(web.body).toEqual(JSON.parse(JSON.stringify(router.body)));
  });
});

describe('the two REST edges answer one status set, read off the contract', () => {
  it('on findById of a missing row: 404, in one body shape', async () => {
    const { router, web } = await bothEdges('findById', { id: 'missing' });
    expect([router.status, web.status]).toEqual([404, 404]);
    expect(web.body).toEqual(JSON.parse(JSON.stringify(router.body)));
    expect(router.body).toMatchObject({ code: 'NOT_FOUND' });
  });

  it('on create: 201 on both', async () => {
    const router = await viaRouter('create', { input: article });
    const web = await viaWeb('create', { input: article });
    expect([router.status, web.status]).toEqual([201, 201]);
  });

  it('on delete: 204 and no body on both', async () => {
    const router = await viaRouter('delete', { id: (await created()).id });
    const web = await viaWeb('delete', { id: (await created()).id });
    expect([router.status, web.status, router.body, web.body]).toEqual([204, 204, null, null]);
  });

  it('on delete of a missing row: 404 on both', async () => {
    const { router, web } = await bothEdges('delete', { id: 'missing' });
    expect([router.status, web.status]).toEqual([404, 404]);
  });

  it('on list: the same envelope on both, so the page facts survive JSON', async () => {
    await created();
    const { router, web } = await bothEdges('list');
    expect(web.body).toEqual(JSON.parse(JSON.stringify(router.body)));
    expect(router.body).toMatchObject({ items: expect.any(Array) });
  });
});
