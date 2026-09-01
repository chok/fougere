/**
 * A surface is a key of the runner — the audience a door serves.
 *
 * `handlers/public/NoteHandler.ts` builds a second façade under `public:noteHandler`
 * (`bootstrap.ts`, `facadeKeyOf`). What was missing until now: nothing tested the local
 * path. The REST and GraphQL adapters had their own tests; the runner and the identity
 * card, which the envelope stands on, had none.
 */
import { scanProject } from '../src/node.js';
import { describe, it, expect, vi } from 'vitest';
import { join } from 'node:path';
import { createContainer } from '@fougere/container';
import { createApp, createAppRunner, ErrorCode } from '../src/index.js';
import type { StorageFactory, IdentityCard } from '../src/index.js';
import { EMPTY_INVOCATION } from '../src/contract/Invocation.js';

const root = join(import.meta.dirname, 'fixtures-surface');

/**
 * Full rows — and `output(view)` really narrows, as `SqlStorage` does.
 *
 * That matters here: a handler-wide view (`Crud(Note, NoteCard)`) is realized by SCOPING
 * THE storage, not by projecting at the façade — the façade's projection stays open, so it
 * passes unknown keys through. A fake whose `output()` answered itself would therefore
 * have shown the secret leaking and blamed the framework.
 */
function storageFor(entity: { name: string }) {
  const full: Record<string, unknown> = entity.name === 'note'
    ? { id: 'n1', title: 'Titre', secret: 'planqué' }
    : { id: 'l1', amount: 42 };

  const make = (keys?: string[]) => {
    const row = keys ? Object.fromEntries(keys.filter((k) => k in full).map((k) => [k, full[k]])) : full;
    const storage: any = {
      list: vi.fn(async () => [row]),
      findById: vi.fn(async () => row),
      findBy: vi.fn(async () => row),
      findAllBy: vi.fn(async () => [row]),
      create: vi.fn(async () => row),
      update: vi.fn(async () => row),
      delete: vi.fn(async () => true),
      output: (schema: { getFields(): Record<string, unknown> }) => make(Object.keys(schema.getFields())),
    };
    return storage;
  };
  return make();
}

const scan = await scanProject(root);
const boot = () => createApp({
  scan,
  createContainer,
  storageFactory: ((e: any, name: string) => storageFor({ name })) as unknown as StorageFactory,
});

describe('the envelope, per audience', () => {
  it('the default door serves the whole row', async () => {
    const app = await boot();
    const row = await createAppRunner(app)({ entity: 'note', op: 'list' }, EMPTY_INVOCATION) as any[];
    expect(row[0]).toHaveProperty('secret', 'planqué');
    await app.dispose();
  });

  it('a named door serves its own façade — the secret does not leave', async () => {
    const app = await boot();
    const row = await createAppRunner(app, 'public')({ entity: 'note', op: 'list' }, EMPTY_INVOCATION) as any[];
    expect(Object.keys(row[0]).sort()).toEqual(['id', 'title']);
    await app.dispose();
  });

  /** Naming an audience closes it: Ledger has no public handler, so it is not there. */
  it('a named door refuses an entity nothing named into it', async () => {
    const app = await boot();
    await expect(
      createAppRunner(app, 'public')({ entity: 'ledger', op: 'list' }, EMPTY_INVOCATION),
    ).rejects.toMatchObject({ code: ErrorCode.NOT_FOUND });
    await app.dispose();
  });

  it('the identity card answers per audience too', async () => {
    const app = await boot();
    const all = await createAppRunner(app)({ entity: 'rpc', op: 'discover' }, EMPTY_INVOCATION) as IdentityCard;
    const pub = await createAppRunner(app, 'public')({ entity: 'rpc', op: 'discover' }, EMPTY_INVOCATION) as IdentityCard;

    expect(all.fronds[0].doors.map((d) => d.name).sort()).toEqual(['ledger', 'note']);
    expect(pub.fronds[0].doors.map((d) => d.name)).toEqual(['note']);
    await app.dispose();
  });
});
