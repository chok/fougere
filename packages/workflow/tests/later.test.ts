/**
 * A call that has not happened yet — the same call, later.
 *
 * `runAt` is the whole of it: the dispatcher answers nothing and hands the call to the journal,
 * the beat makes it at its hour, and what runs then is what the caller wrote — same address,
 * same validator, same handler. Nothing here is a second way to execute.
 */
import { describe, it, expect, vi } from 'vitest';
import { createContainer } from '@fougere/container';
import { entity, primary, text, type SchemaView } from '@fougere/schema';
import {
  createApp, Crud, frond, storageOver,
  type App, type Storage, type Store,
} from '@fougere/core';
import { workflow } from '../src/index.js';

class Note extends entity({ id: primary(text()), body: text() }) {}
class NoteHandler extends Crud(Note) {}

const store = (): Store => {
  const kept = new Map<string, Record<string, unknown>>();

  return {
    get: async (key) => kept.get(key),
    has: async (key) => kept.has(key),
    set: async (key, values) => { kept.set(key, values); },
    delete: async (key) => kept.delete(key),
    all: async () => [...kept.values()],
    client: kept,
  };
};

async function booting(sweepMs: number): Promise<App> {
  (['debug', 'info', 'log', 'warn', 'error'] as const)
    .forEach((method) => vi.spyOn(console, method).mockImplementation(() => undefined));

  return createApp({
    createContainer,
    storageFactory: storageOver((_schema: SchemaView, _name: string) => store()) as never,
    fronds: [frond('notes', { entities: [Note], handlers: [NoteHandler] })],
    extensions: [workflow({ sweepMs })],
  });
}

const notes = (app: App) => app.storageFor('note') as Storage;
const laters = (app: App) => app.storageFor('later') as Storage;

describe('a call that runs later', () => {
  it('answers nothing now, and keeps the call whole', async () => {
    const app = await booting(0);

    const answer = await app.dispatch({
      address: { entity: 'note', operation: 'create' },
      invocation: { input: { id: 'n1', body: 'hello' }, runAt: Date.now() + 60_000 },
    } as never);

    expect(answer).toBeUndefined();
    expect(await notes(app).list()).toHaveLength(0);

    const kept = await laters(app).list();
    expect(kept).toHaveLength(1);
    expect(kept[0]).toMatchObject({ entity: 'note', operation: 'create' });
    expect((kept[0] as { invocation: { input: unknown } }).invocation.input)
      .toEqual({ id: 'n1', body: 'hello' });

    await app.dispose();
  });

  it('makes it at its hour, through the handler that would have answered', async () => {
    const app = await booting(20);

    await app.dispatch({
      address: { entity: 'note', operation: 'create' },
      invocation: { input: { id: 'n2', body: 'due' }, runAt: Date.now() - 1 },
    } as never);

    await vi.waitFor(async () => {
      expect(await notes(app).list()).toHaveLength(1);
    }, { timeout: 2_000 });

    expect(await laters(app).list()).toHaveLength(0);

    await app.dispose();
  });

  it('refuses when nothing keeps it, and names what would', async () => {
    (['debug', 'info', 'log', 'warn', 'error'] as const)
      .forEach((method) => vi.spyOn(console, method).mockImplementation(() => undefined));

    const app = await createApp({
      createContainer,
      storageFactory: storageOver((_schema: SchemaView, _name: string) => store()) as never,
      fronds: [frond('notes', { entities: [Note], handlers: [NoteHandler] })],
    });

    await expect(app.dispatch({
      address: { entity: 'note', operation: 'create' },
      invocation: { input: { id: 'n3', body: 'orphan' }, runAt: Date.now() + 1000 },
    } as never)).rejects.toThrow(/@fougere\/workflow/);

    await app.dispose();
  });
});
