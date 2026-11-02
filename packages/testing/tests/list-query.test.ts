/**
 * A list read off its URL: every value arrives as text, and a criterion is a field's own name.
 * `?limit=1` used to be refused as "not a whole number", and `?title=x` as an unknown option.
 */
import { afterAll, describe, expect, it } from 'vitest';
import { join } from 'node:path';
import { answered } from './web.js';
import { testApp } from '../src/index.js';

const app = await testApp({ root: join(import.meta.dirname, 'fixtures'), fronds: ['press'] });
afterAll(() => app.dispose());

const list = async (query: string) => (await answered(app, 'GET', `/api/press/articles${query}`, {}))!;
const titles = (body: unknown) => (body as { items: { title: string }[] }).items.map((item) => item.title);

for (const title of ['One', 'Two', 'Three']) {
  await answered(app, 'POST', '/api/press/articles', { body: { title, body: 'b', status: 'draft', views: title.length } });
}

describe('a list read off its URL', () => {
  it('pages with the numbers the URL wrote as text', async () => {
    const { status, body } = await list('?limit=1&offset=1&count=true');

    expect(status).toBe(200);
    expect(body).toMatchObject({ total: 3, hasMore: true });
    expect(titles(body)).toHaveLength(1);
  });

  it('filters on a field named as itself, read through its own shape', async () => {
    expect(titles((await list('?title=Two')).body)).toEqual(['Two']);
    expect(titles((await list('?views=5')).body)).toEqual(['Three']);
  });

  it('refuses a count that is not one, and a key that is neither an option nor a field', async () => {
    expect(await list('?limit=abc')).toMatchObject({ status: 400, body: { code: 'BAD_REQUEST' } });
    expect(await list('?titel=Two')).toMatchObject({ status: 400, body: { code: 'BAD_REQUEST' } });
  });
});
