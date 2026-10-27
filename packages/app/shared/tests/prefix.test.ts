/**
 * `protocols.rest.prefix` is the one place REST is mounted. A door that mounts itself reads it
 * without booting; a host that routes by file is told when its file sits elsewhere.
 */
import { afterEach, describe, it, expect } from 'vitest';
import { answer, fougere } from '../src/web.js';
import { configureFougere, useFougereApp } from '../src/boot.js';

const prefixed = (prefix: string) =>
  configureFougere({ config: { protocols: { rest: { prefix } } }, fronds: [], storage: { storageFactory: () => ({}) as never } });

afterEach(() => configureFougere({}));

describe('the prefix the config states', () => {
  it('is where REST starts answering, and what it leaves to the app', async () => {
    prefixed('/v1');

    expect(await answer(await useFougereApp(), new Request('http://localhost/api/blog/posts'))).toBeUndefined();
  });

  it('names the route file a file-routed host left under the old prefix', async () => {
    prefixed('/v1');

    const response = await fougere(new Request('http://localhost/api/blog/posts'));

    expect(response.status).toBe(404);
    expect((await response.json() as { message: string }).message).toContain('is not under the REST prefix /v1');
  });
});
