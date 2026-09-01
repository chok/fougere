/**
 * `frond.config.ts` states an operation's contract.
 *
 * The façade consumes {@link OperationContract} and nothing else, so it has three
 * indistinguishable producers: a prefab DECLARES (`Crud.__ops`), the scan DERIVES from
 * source, config STATES. That is what makes the scan a convenience rather than a
 * dependency — and it is the only answer for an op the scan cannot see at all.
 */
import { scanProject } from '../src/node.js';
import { describe, it, expect, vi } from 'vitest';
import { join } from 'node:path';
import { createContainer } from '@fougere/container';
import { createApp, createLocalRunner, FougereError, ErrorCode } from '../src/index.js';
import type { StorageFactory } from '../src/index.js';
import type { InvocationContext } from '../src/contract/Invocation.js';

const root = join(import.meta.dirname, 'fixtures-config-contract');

function noteStorage() {
  const row = { id: 'note-1', title: 'Titre', body: 'Le corps', ownerId: 'u1', createdAt: 'now' };
  const storage = {
    list: vi.fn(async () => [row]),
    findById: vi.fn(async () => row),
    create: vi.fn(async () => row),
    update: vi.fn(async () => row),
    delete: vi.fn(async () => true),
    output: vi.fn(() => storage),
  };
  return storage;
}

async function boot() {
  const app = await createApp({
    scan: await scanProject(root),
    createContainer,
    storageFactory: vi.fn(() => noteStorage()) as unknown as StorageFactory,
  });
  return { app, run: createLocalRunner(app) };
}

const call = (over: Partial<InvocationContext> = {}): InvocationContext =>
  ({ params: {}, query: {}, body: undefined, state: {}, ...over });

describe('config states a contract the scan could not derive', () => {
  it('names the judge for a body the scan could only see as an object', async () => {
    const { app, run } = await boot();

    const ok = await run({ entity: 'note', op: 'retitle' }, call({ body: { title: 'Neuf' } }));
    expect((ok as Record<string, unknown>).title).toBe('Neuf');

    await app.dispose();
  });

  it('and that judge REFUSES — the config input is enforced, not decorative', async () => {
    const { app, run } = await boot();

    // `title` is `text({ min: 1 })`, and `body` is not in the declared view.
    await expect(run({ entity: 'note', op: 'retitle' }, call({ body: { title: '' } })))
      .rejects.toMatchObject({ code: ErrorCode.VALIDATION_FAILED });

    await expect(run({ entity: 'note', op: 'retitle' }, call({ body: { title: 'Ok', body: 'intrus' } })))
      .rejects.toThrow(/Unknown field/);

    await app.dispose();
  });
});

describe('config declares an op the scan never saw', () => {
  it('puts it on the façade — the answer for a method inherited from an installed base', async () => {
    const { app, run } = await boot();

    const facade = app.resolve<Record<string, unknown>>('noteHandler');
    expect(Object.keys(facade)).toContain('archive');

    const out = await run({ entity: 'note', op: 'archive' }, call({ params: { id: 'note-9' } }));
    expect(out).toEqual({ id: 'note-9', archived: true });

    await app.dispose();
  });

  it('binds its arguments from the stated plan, not from a guess on the name', async () => {
    const { app, run } = await boot();

    // No `id` in params → the plan still applies, the handler receives undefined
    // rather than the op being unreachable or the id being invented from elsewhere.
    const out = await run({ entity: 'note', op: 'archive' }, call()) as Record<string, unknown>;
    expect(out.id).toBeUndefined();

    await app.dispose();
  });
});

describe('an op nobody declared stays unreachable', () => {
  it('config adds ops, it does not open the whole prototype', async () => {
    const { app, run } = await boot();

    await expect(run({ entity: 'note', op: 'constructor' }, call()))
      .rejects.toBeInstanceOf(FougereError);
    await expect(run({ entity: 'note', op: 'toString' }, call()))
      .rejects.toMatchObject({ code: ErrorCode.NOT_FOUND });

    await app.dispose();
  });
});
