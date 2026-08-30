/**
 * The contract of an op belongs to the façade, not to the scan that found it.
 *
 * A `Crud(E)` op arrives by prototype. The AST parser only sees it when it can
 * resolve the mixin's source — and it resolves `@fougere/core` as
 * `<workspaceRoot>/packages/core/src`, a layout that exists only inside this
 * monorepo. An installed app falls back to its own root, finds nothing, and
 * every inherited op would reach the ORM unjudged.
 *
 * So both worlds are covered here: inside the workspace the scan discovers the
 * ops, outside it discovers nothing — and the façade must judge either way.
 */
import { scanProject } from '../src/node.js';
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { join } from 'node:path';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { createContainer } from '@fougere/container';
import { createApp, createLocalRunner } from '../src/index.js';
import type { OrmFactory } from '../src/index.js';
import type { InvocationContext } from '../src/contract/Invocation.js';

const packagesDir = join(import.meta.dirname, '..', '..');
const coreDist = join(packagesDir, 'core', 'dist', 'index.js');
const schemaDist = join(packagesDir, 'schema', 'dist', 'index.js');

/** An ORM that realises and never judges — like the real one. */
function spyOrm() {
  const rows: Record<string, unknown>[] = [];
  const orm = {
    rows,
    list: vi.fn(async () => ({ data: rows })),
    findById: vi.fn(async (id: string) => rows.find((r) => r.id === id)),
    create: vi.fn(async (input: Record<string, unknown>) => {
      const row = { id: 'generated', ...input };
      rows.push(row);
      return row;
    }),
    update: vi.fn(async (id: string, input: Record<string, unknown>) => ({ id, ...input })),
    delete: vi.fn(async () => true),
    output: () => orm,
  };
  return orm;
}

async function boot(root: string) {
  const orm = spyOrm();
  const ormFactory: OrmFactory = vi.fn(() => orm) as unknown as OrmFactory;
  const app = await createApp({ scan: await scanProject(root), createContainer, ormFactory });
  return { app, orm, run: createLocalRunner(app) };
}

const call = (body: unknown): InvocationContext => ({ params: {}, query: {}, body, state: {} });

/**
 * A project as an installed app really looks: outside any pnpm workspace, with
 * Fougere reached by a path the AST parser does not follow. Written in JS so no
 * transform stands between the scanner and the file.
 */
function writeInstalledApp(): string {
  const root = mkdtempSync(join(tmpdir(), 'fougere-installed-'));
  const frond = join(root, 'fronds', 'shop');
  mkdirSync(join(frond, 'entities'), { recursive: true });
  mkdirSync(join(frond, 'handlers'), { recursive: true });

  writeFileSync(join(frond, 'entities', 'Note.js'), `
import { entity, primary, text, readOnly, created } from ${JSON.stringify(schemaDist)};
export default class Note extends entity({
  id: primary(),
  title: text(),
  ownerId: readOnly(text()),
  createdAt: created(),
}) {}
`);
  writeFileSync(join(frond, 'handlers', 'NoteHandler.js'), `
import { Crud } from ${JSON.stringify(coreDist)};
import Note from '../entities/Note.js';
export default class NoteHandler extends Crud(Note) {}
`);
  return root;
}

describe('inside the workspace, the scan discovers the inherited ops', () => {
  it('resolves the heritage clause and finds the five', async () => {
    const { app } = await boot(join(import.meta.dirname, 'fixtures-crud'));
    expect(app.fronds[0].handlers[0].operations.size).toBe(5);
    await app.dispose();
  });
});

describe('as an installed app — the scan finds nothing, the façade judges anyway', () => {
  let root: string;
  beforeAll(() => { root = writeInstalledApp(); });
  afterAll(() => { rmSync(root, { recursive: true, force: true }); });

  /**
   * The scan discovers nothing here — that is the real case, and the prefab answers it.
   *
   * The boot hands the RESOLVED contracts back onto the handler, so the five are there
   * for every reader and not only for the façade. They used to be `0`, and this file
   * asserted the `0`: an adapter reading `handler.operations` (both do) then published
   * a schema missing four of the five CRUD ops while the façade served them.
   */
  it('stands on the real case: the scan finds none, and the prefab supplies the five', async () => {
    const { app } = await boot(root);
    const ops = app.fronds[0].handlers[0].operations;
    expect([...ops.keys()].sort()).toEqual(['create', 'delete', 'findById', 'list', 'update']);
    // Each carries the TYPES a GraphQL argument needs — `binding` only says where from.
    expect(ops.get('findById')!.signature!.params).toEqual([{ name: 'id', type: { raw: 'string', name: 'string' } }]);
    // The ops themselves still arrive by prototype, as they always did.
    expect(Object.keys(app.resolve('noteHandler') as object).sort())
      .toEqual(['create', 'delete', 'findById', 'list', 'update']);
    await app.dispose();
  });

  it('refuses a read-only field supplied at create', async () => {
    const { app, orm, run } = await boot(root);

    await expect(
      run({ entity: 'note', op: 'create' }, call({ title: 'hello', ownerId: 'someone-else' })),
    ).rejects.toMatchObject({ code: 'VALIDATION_FAILED', message: expect.stringContaining('Read-only') });

    expect(orm.create).not.toHaveBeenCalled();
    await app.dispose();
  });

  it('refuses a key outside the contract at create (mass assignment)', async () => {
    const { app, orm, run } = await boot(root);

    await expect(
      run({ entity: 'note', op: 'create' }, call({ title: 'hello', isAdmin: true })),
    ).rejects.toMatchObject({ code: 'VALIDATION_FAILED', message: expect.stringContaining('Unknown field') });

    expect(orm.create).not.toHaveBeenCalled();
    await app.dispose();
  });

  it('refuses an immutable field re-supplied in a patch', async () => {
    const { app, orm, run } = await boot(root);

    await expect(
      run({ entity: 'note', op: 'update' }, { ...call({ id: 'forged', title: 'x' }), params: { id: 'note-1' } }),
    ).rejects.toMatchObject({ code: 'VALIDATION_FAILED', message: expect.stringContaining('Immutable') });

    expect(orm.update).not.toHaveBeenCalled();
    await app.dispose();
  });

  it('lets a legal create through, untouched', async () => {
    const { app, orm, run } = await boot(root);

    const created = await run({ entity: 'note', op: 'create' }, call({ title: 'hello' }));

    expect(orm.create).toHaveBeenCalledWith({ title: 'hello' });
    expect(created).toMatchObject({ title: 'hello' });
    await app.dispose();
  });

  it('leaves a partial patch legal — an unsent field is untouched', async () => {
    const { app, orm, run } = await boot(root);

    await run({ entity: 'note', op: 'update' }, { ...call({ title: 'renamed' }), params: { id: 'note-1' } });

    expect(orm.update).toHaveBeenCalledWith('note-1', { title: 'renamed' });
    await app.dispose();
  });
});

describe('the façade answers what it declares, and nothing JS lends it', () => {
  let root: string;
  beforeAll(() => { root = writeInstalledApp(); });
  afterAll(() => { rmSync(root, { recursive: true, force: true }); });

  it.each(['constructor', 'toString', 'valueOf', '__proto__', 'hasOwnProperty'])(
    'refuses %s — inherited from Object, never declared',
    async (op) => {
      const { app, run } = await boot(root);
      await expect(run({ entity: 'note', op }, call(undefined)))
        .rejects.toMatchObject({ code: 'NOT_FOUND' });
      await app.dispose();
    },
  );

  it('leaves an entity with no façade out of the identity card', async () => {
    const { app, run } = await boot(root);
    const card = await run({ entity: 'rpc', op: 'discover' }, call(undefined)) as {
      fronds: { doors: { name: string; ops: string[] }[] }[];
    };
    // Note has a handler, so it is hosted; every listed entity must be callable.
    const listed = card.fronds.flatMap((f) => f.doors);
    expect(listed.map((e) => e.name)).toEqual(['note']);
    expect(listed.every((e) => e.ops.length > 0)).toBe(true);
    await app.dispose();
  });
});
