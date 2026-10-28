/**
 * A web host reads the schema and never writes it: a database behind the entities refuses the
 * boot, and only a process whose database is born with it says it migrates.
 */
import '@fougere/adapter-sql';
import { describe, it, expect, vi } from 'vitest';
import { entity, primary, text } from '@fougere/schema';
import { BootRefusal, frond } from '@fougere/core';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { resolveStorage } from '@fougere/defaults';
import { configureFougere, useFougereApp } from '../src/boot.js';
import { fougere } from '../src/web.js';

class Note extends entity({ id: primary(), title: text() }) {}

const fronds = [frond('notes', { entities: [Note] })];
const config = { sources: { main: { type: 'sqlite', path: ':memory:' } } } as never;

describe('the schema on a web host', () => {
  it('refuses a database behind the entities, naming the table', async () => {
    configureFougere({ fronds, config });

    await expect(useFougereApp()).rejects.toThrow(/missing 1 change\(s\) from the entities:\n {2}notes — no table/);
  });

  it('answers a call with the refusal, under the id it was asked with', async () => {
    configureFougere({ fronds, config });
    expect(await useFougereApp().catch((failure: unknown) => failure)).toBeInstanceOf(BootRefusal);
    const call = () => new Request('http://localhost/_fougere/call', {
      method: 'POST',
      body: JSON.stringify({ jsonrpc: '2.0', id: 7, method: 'note.list', params: {} }),
    });

    expect(await (await fougere(call())).json()).toMatchObject({
      id: 7,
      error: { data: { code: 'SERVICE_UNAVAILABLE', message: expect.stringMatching(/notes — no table/) } },
    });
    vi.stubEnv('NODE_ENV', 'production');
    expect(await (await fougere(call())).json()).toMatchObject({
      id: 7,
      error: { data: { code: 'SERVICE_UNAVAILABLE', message: 'The app refused to start.' } },
    });
    vi.unstubAllEnvs();
  });

  it('boots at the next call once the database caught up — a refusal is not kept', async () => {
    const path = join(mkdtempSync(join(tmpdir(), 'schema-')), 'app.db');
    configureFougere({ fronds, config: { sources: { main: { type: 'sqlite', path } } } as never });
    await expect(useFougereApp()).rejects.toThrow(/missing \d+ change\(s\) from the entities/);

    const storage = resolveStorage({ main: { type: 'sqlite', path } });
    await storage.migrate?.({ fronds } as never);
    await storage.close?.();

    const app = await useFougereApp();
    expect(app.fronds.entityNames()).toEqual(['note']);
    await app.dispose();
  });

  it('keeps a storage the host handed in open across a refusal — the host closes what it opened', async () => {
    const path = join(mkdtempSync(join(tmpdir(), 'schema-')), 'app.db');
    const storage = resolveStorage({ main: { type: 'sqlite', path } });
    configureFougere({ fronds, config: { sources: { main: { type: 'sqlite', path } } } as never, storage });
    await expect(useFougereApp()).rejects.toThrow(/missing \d+ change\(s\) from the entities/);

    await storage.migrate?.({ fronds } as never);
    const app = await useFougereApp();
    await app.storageFor('note')!.create({ title: 'still open' });

    await app.dispose();
    await storage.close?.();
  });

  it('writes it when the process says it migrates', async () => {
    configureFougere({ fronds, config, migrates: true });
    const app = await useFougereApp();

    await app.storageFor('note')!.create({ title: 'kept' });
    expect(app.extensions()).toEqual(['schema', 'values', 'seeds']);
    await app.dispose();
  });
});
