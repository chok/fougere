/**
 * A web host reads the schema and never writes it: a database behind the entities refuses the
 * boot, and only a process whose database is born with it says it migrates.
 */
import { describe, it, expect } from 'vitest';
import { entity, primary, text } from '@fougere/schema';
import { BootRefusal, frond } from '@fougere/core';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { resolveStorage } from '@fougere/defaults';
import { configureFougere, useFougereApp } from '../src/boot.js';
import { refusedRpc } from '../src/Outcome.js';

class Note extends entity({ id: primary(), title: text() }) {}

const fronds = [frond('notes', { entities: [Note] })];
const config = { db: { dialect: 'sqlite', path: ':memory:' } } as never;

describe('the schema on a web host', () => {
  it('refuses a database behind the entities, naming the table', async () => {
    configureFougere({ fronds, config });

    await expect(useFougereApp()).rejects.toThrow(/behind the entities \(1\):\n {2}notes — no table/);
  });

  it('answers a call with the refusal, under the id it was asked with', async () => {
    configureFougere({ fronds, config });
    const refusal = await useFougereApp().catch((failure: unknown) => failure);
    expect(refusal).toBeInstanceOf(BootRefusal);
    const call = { jsonrpc: '2.0', id: 7, method: 'note.list', params: {} };

    expect(await refusedRpc(refusal as BootRefusal, call, true)).toMatchObject({
      id: 7,
      error: { data: { code: 'SERVICE_UNAVAILABLE', message: expect.stringMatching(/notes — no table/) } },
    });
    expect(await refusedRpc(refusal as BootRefusal, call, false)).toMatchObject({
      id: 7,
      error: { data: { code: 'SERVICE_UNAVAILABLE', message: 'The app refused to start.' } },
    });
  });

  it('boots at the next call once the database caught up — a refusal is not kept', async () => {
    const path = join(mkdtempSync(join(tmpdir(), 'schema-')), 'app.db');
    configureFougere({ fronds, config: { db: { dialect: 'sqlite', path } } as never });
    await expect(useFougereApp()).rejects.toThrow(/behind the entities/);

    const storage = resolveStorage({ dialect: 'sqlite', path });
    await storage.migrate?.({ fronds } as never);
    await storage.close?.();

    const app = await useFougereApp();
    expect(app.fronds.entityNames()).toEqual(['note']);
    await app.dispose();
  });

  it('keeps a storage the host handed in open across a refusal — the host closes what it opened', async () => {
    const path = join(mkdtempSync(join(tmpdir(), 'schema-')), 'app.db');
    const storage = resolveStorage({ dialect: 'sqlite', path });
    configureFougere({ fronds, config: { db: { dialect: 'sqlite', path } } as never, storage });
    await expect(useFougereApp()).rejects.toThrow(/behind the entities/);

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
    expect(app.extensions()).toEqual(['schema', 'seeds']);
    await app.dispose();
  });
});
