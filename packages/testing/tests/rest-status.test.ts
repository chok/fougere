/**
 * REST answers one status set, read off the contract — 201 for a POST on the collection answering
 * one row, 204 for a deletion, 404 in one body shape — on every host, since every host answers
 * through `answer`. Two edges used to decide them apart: 201 against 200, 204 against 200, two 404
 * bodies.
 */
import { afterAll, describe, expect, it } from 'vitest';
import { join } from 'node:path';
import { generateRoutes } from '@fougere/adapter-rest';
import { answered } from './web.js';
import { testApp } from '../src/index.js';

const app = await testApp({ root: join(import.meta.dirname, 'fixtures'), fronds: ['press'] });
afterAll(() => app.dispose());

const routes = generateRoutes(app);

type Call = { id?: string; input?: Record<string, unknown> };

const routeOf = (op: string) => routes.find((one) => one.address === 'article' && one.operationName === op)!;
const pathOf = (op: string, call: Call) => routeOf(op).path.replace(':id', call.id ?? '');

async function rest(op: string, call: Call = {}) {
  const answer = await answered(app, routeOf(op).method, pathOf(op, call), { body: call.input });
  if (!answer) throw new Error(`REST answered nothing on ${op}`);

  return answer;
}

const article = { title: 'One edge', body: 'One op', status: 'draft', views: 1 };
const created = async () => (await rest('create', { input: article })).body as { id: string };

describe('REST answers one status set, read off the contract', () => {
  it('on list: 200, and the page facts survive JSON', async () => {
    await created();
    const { status, body } = await rest('list');

    expect(status).toBe(200);
    expect(body).toMatchObject({ items: expect.any(Array), hasMore: false });
  });

  it('on findById: 200 for a row that exists, 404 with NOT_FOUND for one that does not', async () => {
    expect((await rest('findById', { id: (await created()).id })).status).toBe(200);
    expect(await rest('findById', { id: 'missing' })).toMatchObject({ status: 404, body: { code: 'NOT_FOUND' } });
  });

  it('on create: 201, and 400 for a refused input', async () => {
    expect((await rest('create', { input: article })).status).toBe(201);
    expect((await rest('create', { input: { ...article, title: 'x' } })).status).toBe(400);
  });

  it('on update: 200', async () => {
    expect((await rest('update', { id: (await created()).id, input: { title: 'Retitled' } })).status).toBe(200);
  });

  it('on delete: 204 and no body, 404 for a missing row', async () => {
    expect(await rest('delete', { id: (await created()).id })).toMatchObject({ status: 204, body: null });
    expect((await rest('delete', { id: 'missing' })).status).toBe(404);
  });
});
