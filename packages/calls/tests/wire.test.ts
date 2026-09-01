import { join } from 'node:path';
import { createContainer } from '@fougere/container';
import { describe, expect, it, vi } from 'vitest';
import { Call, RouteAddress, createApp, createAppRunner, createLocalRunner, type CallPage, type StorageFactory } from '@fougere/core';
import { scanProject } from '@fougere/core/node';
import { serve } from '@fougere/transport-http';
import { createHttpTransport } from '@fougere/transport-http/client';
import { calls } from '../src/index.js';

const fixtures = join(import.meta.dirname, 'fixtures');
const storageFactory: StorageFactory = () => ({
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
      storageFactory,
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

/**
 * Two consumers, one hosted frond — what its own ring shows.
 *
 * This is the shape that matters in a split deployment: the hosted process serves several
 * apps, so its log mixes them, and what separates them is what the callers put on the
 * invocation. Nothing else can: an address carries no consumer.
 */
describe('two apps against one hosted frond', () => {
  it('mixes both consumers in the hosted ring, and separates them only by what they signed', async () => {
    await using hosted = await createApp({
      scan: await scanProject(fixtures),
      createContainer,
      storageFactory,
      extensions: [calls()],
    });
    const door = await serve(createLocalRunner(hosted), { port: 0 });
    const at = `http://127.0.0.1:${door.port}`;

    try {
      // Two consumers, each with its own ring, both reaching the same hosted frond.
      const consumers = await Promise.all([1, 2].map(async () => await createApp({
        scan: await scanProject(fixtures),
        createContainer,
        storageFactory,
        remotes: { shop: at },
        remoteTransport: (url) => createHttpTransport(url),
        extensions: [calls()],
      })));

      for (const consumer of consumers) {
        await consumer.dispatch(new Call(new RouteAddress({ entity: 'order', operation: 'list' })));
      }

      const read = (app: (typeof consumers)[number]) => createAppRunner(app)(
        { entity: 'rpc', op: 'calls' },
        { params: {}, query: {}, body: { since: 0 }, state: {} },
      ) as Promise<CallPage>;

      // Each consumer's own ring holds ONE call — its own.
      for (const consumer of consumers) {
        const page = await read(consumer);
        expect(page.calls).toHaveLength(1);
        expect(page.calls[0]).toMatchObject({ entity: 'order', operation: 'list' });
      }

      // The hosted ring holds BOTH executions, and — with nobody signing on loopback —
      // nothing on them says which consumer sent which. That absence is the finding.
      const hostedPage = await read(hosted as never);
      expect(hostedPage.calls).toHaveLength(2);
      expect(hostedPage.calls.every((one) => one.caller === undefined)).toBe(true);

      for (const consumer of consumers) await consumer.dispose();
    } finally {
      await door.close();
    }
  });
});
