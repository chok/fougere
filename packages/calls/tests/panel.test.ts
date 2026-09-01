import { join } from 'node:path';
import { createContainer } from '@fougere/container';
import { describe, expect, it, vi } from 'vitest';
import { Call, RouteAddress, createApp, type StorageFactory } from '@fougere/core';
import { scanProject } from '@fougere/core/node';
import { calls } from '../src/index.js';

const fixtures = join(import.meta.dirname, 'fixtures');
const storageFactory: StorageFactory = () => ({
  list: vi.fn(async () => [{ id: '1', label: 'a first order' }]),
  findById: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(),
}) as never;

/** The page's own door — its own port, loopback only, no CORS to arrange. */
describe('the panel', () => {
  it('serves the page, a snapshot, and pushes a call as it settles', async () => {
    let at = '';
    const app = await createApp({
      scan: await scanProject(fixtures),
      createContainer,
      storageFactory,
      extensions: [calls({ panel: { port: 0, announce: (url) => { at = url; } } })],
    });

    try {
      expect(at).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/);

      const html = await fetch(`${at}/`);
      expect(html.status).toBe(200);
      expect(html.headers.get('content-type')).toContain('text/html');
      expect(await html.text()).toContain('in flight');

      // The stream opens with what the ring already holds, so a late reader sees history.
      const stream = await fetch(`${at}/events`);
      const reader = stream.body!.getReader();
      const hello = new TextDecoder().decode((await reader.read()).value);
      expect(hello).toContain('event: hello');
      expect(hello).toContain('"fronds":["shop","warehouse"]');

      // Then a call, pushed as it settles.
      await app.dispatch(new Call(new RouteAddress({ entity: 'order', operation: 'list' })));
      const pushed = new TextDecoder().decode((await reader.read()).value);
      expect(pushed).toContain('event: call');
      expect(pushed).toContain('"operation":"list"');
      await reader.cancel();

      const snapshot = await (await fetch(`${at}/calls.json`)).json() as { calls: unknown[] };
      expect(snapshot.calls).toHaveLength(1);

      // What this process would answer, whether or not anything called it yet — the view
      // that makes an untouched panel useful instead of blank.
      const model = await (await fetch(`${at}/model.json`)).json() as {
        fronds: {
          name: string; declared: 'local' | 'remote'; at: string | null; entities: string[];
          operations: { address: string; kind: string; placement: string; parameters: unknown[] }[];
        }[];
      };
      expect(model.fronds.map((one) => one.name)).toEqual(['shop', 'warehouse']);
      // Declared placement, beside what the ring observed: the config says where a call
      // GOES, the ring says where it WENT, and they disagree when something is misconfigured.
      expect(model.fronds.every((one) => one.declared === 'local' && one.at === null)).toBe(true);
      const shop = model.fronds[0]!;
      expect(shop.entities).toEqual(['order']);
      expect(shop.operations.map((one) => one.address)).toContain('order.list');
      expect(shop.operations.find((one) => one.address === 'order.list')).toMatchObject({
        kind: 'query',
        placement: 'local',
      });

      const missing = await fetch(`${at}/nope`);
      expect(missing.status).toBe(404);
    } finally {
      await app.dispose();
    }

    // The door closed with the app: the extension's `down` awaits the server.
    await expect(fetch(`${at}/`)).rejects.toThrow();
  });
});
