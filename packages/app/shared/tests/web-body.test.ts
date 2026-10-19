/**
 * A web door reads a body within `maxBodyBytes`, and refuses a body that is not JSON rather than
 * reading it as `{}`. Four doors read without a limit before: REST and GraphQL here, Hono, and Nuxt.
 */
import { afterEach, describe, it, expect } from 'vitest';
import { setMaxBodyBytes } from '@fougere/core';
import { graphql, rest } from '../src/web.js';
import { configureFougere } from '../src/boot.js';
import { jsonBodyOf } from '../src/jsonBody.js';

const post = (body: string, type = 'application/json') =>
  new Request('http://localhost/api/blog/posts', { method: 'POST', body, headers: { 'content-type': type } });

afterEach(() => {
  setMaxBodyBytes(2 * 1024 * 1024);
  configureFougere({});
});

describe('a web door reading a body', () => {
  it('refuses a body that is not JSON with 415', async () => {
    configureFougere({ config: {}, fronds: [], storage: { storageFactory: () => ({}) as never } });

    const response = await rest(post('hello', 'text/plain'));

    expect(response.status).toBe(415);
    expect(await response.json()).toMatchObject({ code: 'UNSUPPORTED_MEDIA_TYPE' });
  });

  it('refuses a body over maxBodyBytes with 413, on GraphQL too', async () => {
    setMaxBodyBytes(16);

    const response = await graphql(post(JSON.stringify({ query: '{ posts { id title body } }' })));

    expect(response.status).toBe(413);
  });

  it('reads a POST with no body as nothing, and malformed JSON as a 400', async () => {
    expect(await jsonBodyOf(new Request('http://localhost/x', { method: 'POST' }))).toBeUndefined();
    await expect(jsonBodyOf(post('{ not json'))).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });
});
