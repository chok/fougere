/** GraphQL over GET: a document in the query string is a read, so a mutation there is refused. */
import { afterAll, describe, expect, it } from 'vitest';
import { join } from 'node:path';
import '@fougere/adapter-graphql';
import { answered } from './web.js';
import { testApp } from '../src/index.js';

const app = await testApp({ root: join(import.meta.dirname, 'fixtures'), fronds: ['press'] });
afterAll(() => app.dispose());

const over = (query: string) => answered(app, 'GET', `/graphql?query=${encodeURIComponent(query)}`);

describe('GraphQL over GET', () => {
  it('answers a query read off the query string', async () => {
    expect(await over('{ __typename }')).toMatchObject({ status: 200, body: { data: { __typename: 'Query' } } });
  });

  it('refuses a mutation, which a GET may not carry', async () => {
    expect((await over('mutation { __typename }'))?.status).toBe(405);
  });
});
