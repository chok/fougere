/**
 * `protocols.rest.prefix` is the one place REST is mounted. A door that mounts itself reads it
 * without booting; a host that routes by file is told when its file sits elsewhere.
 */
import { afterEach, describe, it, expect, vi } from 'vitest';
import { rest as restMiddleware } from '../src/express.js';
import { rest } from '../src/web.js';
import { configureFougere } from '../src/boot.js';

const prefixed = (prefix: string) =>
  configureFougere({ config: { protocols: { rest: { prefix } } }, fronds: [], storage: { storageFactory: () => ({}) as never } });

afterEach(() => configureFougere({}));

describe('the prefix the config states', () => {
  it('is where the Express door starts answering, and what it leaves to the app', async () => {
    prefixed('/v1');
    const next = vi.fn();

    restMiddleware()({ method: 'GET', path: '/api/blog/posts', url: '/api/blog/posts', query: {} } as never, {} as never, next);
    await vi.waitFor(() => expect(next).toHaveBeenCalledOnce());
  });

  it('names the route file a file-routed host left under the old prefix', async () => {
    prefixed('/v1');

    const response = await rest(new Request('http://localhost/api/blog/posts'));

    expect(response.status).toBe(404);
    expect((await response.json() as { message: string }).message).toContain('protocols.rest.prefix mounts at /v1');
  });
});
