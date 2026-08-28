import { join } from 'node:path';
import { createContainer } from '@fougere/container';
import { describe, expect, it, vi } from 'vitest';
import { Call, RouteAddress, createApp, createLocalRunner, type CallPage, type OrmFactory } from '@fougere/core';
import { scanProject } from '@fougere/core/node';
import { serve } from '@fougere/transport-http';
import { createHttpTransport } from '@fougere/transport-http/client';
import { calls } from '../src/index.js';

const fixtures = join(import.meta.dirname, 'fixtures');
const ormFactory: OrmFactory = () => ({
  list: vi.fn(async () => [{ id: '1', label: 'a first order' }]),
  findById: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(),
}) as never;

/**
 * The reader is another process, so this is the only test that proves the whole door: the
 * extension serves an rpc op, the host's call endpoint carries it, and a client — the same
 * one `remotes:` uses, which is the one `fougere devtools` uses — reads the page.
 */
describe('over the wire', () => {
  it('hands one page to a reader that holds no privilege', async () => {
    await using app = await createApp({
      scan: await scanProject(fixtures),
      createContainer,
      ormFactory,
      extensions: [calls()],
    });
    const door = await serve(createLocalRunner(app), { port: 0 });

    try {
      await app.dispatch(new Call(new RouteAddress({ entity: 'order', operation: 'list' })));

      const read = createHttpTransport(`http://127.0.0.1:${door.port}`);
      const page = await read(
        { entity: 'rpc', op: 'calls' },
        { params: {}, query: {}, body: { since: 0 }, state: {} },
      ) as CallPage;

      expect(page.calls).toHaveLength(1);
      expect(page.calls[0]).toMatchObject({ frond: 'shop', entity: 'order', operation: 'list', route: 'local', verdict: 'ok' });
      expect(page.cursor).toBe(1);

      // Reading is itself a call, and it must not appear in what it reads.
      const second = await read(
        { entity: 'rpc', op: 'calls' },
        { params: {}, query: {}, body: { since: page.cursor }, state: {} },
      ) as CallPage;
      expect(second.calls).toHaveLength(0);
    } finally {
      await door.close();
    }
  });
});
