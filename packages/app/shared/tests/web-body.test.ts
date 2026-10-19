/**
 * A web door reads a body within `maxBodyBytes`, and refuses a body that is not JSON rather than
 * reading it as `{}`. REST and GraphQL read through it here and under Nuxt — without a limit, before.
 */
import { afterEach, describe, it, expect } from 'vitest';
import { setMaxBodyBytes } from '@fougere/core';
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
    await expect(jsonBodyOf(post('hello', 'text/plain'))).rejects.toMatchObject({ code: 'UNSUPPORTED_MEDIA_TYPE' });
  });

  it('refuses a body over maxBodyBytes with 413, counted when no length is declared', async () => {
    setMaxBodyBytes(16);

    await expect(jsonBodyOf(post(JSON.stringify({ query: '{ posts { id title body } }' })))).rejects.toMatchObject({ code: 'PAYLOAD_TOO_LARGE' });
  });

  it('reads a POST with no body as nothing, and malformed JSON as a 400', async () => {
    expect(await jsonBodyOf(new Request('http://localhost/x', { method: 'POST' }))).toBeUndefined();
    await expect(jsonBodyOf(post('{ not json'))).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });
});
