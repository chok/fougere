/**
 * What leaves a façade is what a client may read.
 *
 * The judge refuses on the way in, the egress omits on the way out. A handler
 * may legitimately read a write-only field (verifying a password); the result
 * that crosses the façade must not carry it — to a browser or to another frond.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { join } from 'node:path';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { createContainer } from '@fougere/container';
import { createApp, createLocalRunner } from '../src/index.js';
import type { OrmFactory } from '../src/index.js';
import { presentEgress } from '../src/egress.js';

const packagesDir = join(import.meta.dirname, '..', '..');
const coreDist = join(packagesDir, 'core', 'dist', 'index.js');
const schemaDist = join(packagesDir, 'schema', 'dist', 'index.js');

const SECRET = '$2b$10$SUPERSECRET';
const row = { id: 'a1', label: 'prod key', passwordHash: SECRET };

function writeApp(): string {
  const root = mkdtempSync(join(tmpdir(), 'fougere-egress-'));
  const frond = join(root, 'fronds', 'vault');
  mkdirSync(join(frond, 'entities'), { recursive: true });
  mkdirSync(join(frond, 'handlers'), { recursive: true });

  writeFileSync(join(frond, 'entities', 'Secret.js'), `
import { entity, primary, text, writeOnly } from ${JSON.stringify(schemaDist)};
export default class Secret extends entity({
  id: primary(),
  label: text(),
  passwordHash: writeOnly(text()),
}) {}
`);
  writeFileSync(join(frond, 'handlers', 'SecretHandler.js'), `
import { Crud } from ${JSON.stringify(coreDist)};
import Secret from '../entities/Secret.js';
export default class SecretHandler extends Crud(Secret) {
  /** A handler legitimately reads the hash — it just must not leak it. */
  async audit() {
    const all = await this.orm.list();
    return { checked: all.length, computedByHand: 'kept' };
  }
}
`);
  return root;
}

/** The real shape: ListResult IS an array, carrying its cursor on itself. */
function listResult(rows: Record<string, unknown>[]) {
  return Object.assign([...rows], { total: rows.length, hasMore: false, endCursor: 'a1' });
}

async function boot(root: string) {
  const orm = {
    list: vi.fn(async () => listResult([row])),
    findById: vi.fn(async () => row),
    create: vi.fn(async () => row),
    update: vi.fn(async () => row),
    delete: vi.fn(async () => true),
    output: () => orm,
  };
  const app = await createApp({ root, createContainer, ormFactory: (() => orm) as unknown as OrmFactory });
  return { app, run: createLocalRunner(app) };
}

const empty = { params: {}, query: {}, body: undefined, state: {} };

describe('a write-only field never crosses the façade outbound', () => {
  let root: string;
  beforeAll(() => { root = writeApp(); });
  afterAll(() => { rmSync(root, { recursive: true, force: true }); });

  it('omits it from a list, keeping the cursor the array carries', async () => {
    const { app, run } = await boot(root);
    const out = await run({ entity: 'secret', op: 'list' }, empty) as any;

    expect(out[0]).toEqual({ id: 'a1', label: 'prod key' });
    expect(JSON.stringify(out)).not.toContain(SECRET);
    // ListResult is an array — projecting the rows must not drop its metadata.
    expect(out.total).toBe(1);
    expect(out.hasMore).toBe(false);
    expect(out.endCursor).toBe('a1');
    await app.dispose();
  });

  it('omits it from a single record', async () => {
    const { app, run } = await boot(root);
    const out = await run({ entity: 'secret', op: 'findById' }, { ...empty, params: { id: 'a1' } });

    expect(out).toEqual({ id: 'a1', label: 'prod key' });
    await app.dispose();
  });

  it('accepts it inbound and omits it from what the write returns', async () => {
    const { app, run } = await boot(root);
    // write-only is exactly that: a client may SUPPLY it, never read it back.
    const out = await run(
      { entity: 'secret', op: 'create' },
      { ...empty, body: { label: 'prod key', passwordHash: SECRET } },
    );

    expect(out).toEqual({ id: 'a1', label: 'prod key' });
    await app.dispose();
  });

  it('leaves keys the schema knows nothing about untouched', async () => {
    const { app, run } = await boot(root);
    const out = await run({ entity: 'secret', op: 'audit' }, empty);

    expect(out).toEqual({ checked: 1, computedByHand: 'kept' });
    await app.dispose();
  });

  it('passes a scalar result through', async () => {
    const { app, run } = await boot(root);
    const out = await run({ entity: 'secret', op: 'delete' }, { ...empty, params: { id: 'a1' } });

    expect(out).toBe(true);
    await app.dispose();
  });
});

describe('presentEgress — computed fields, added last', () => {
  // The page, not the row: a computed field answers as many values as it was given,
  // in the same order — which is what lets a field that reads do it once.
  const presenter = {
    excerpt: (rows: { body: string }[]) => rows.map((p) => p.body.slice(0, 5)),
    async authorName(rows: { authorId: string }[]) { return rows.map((p) => `author:${p.authorId}`); },
  };
  const names = ['excerpt', 'authorName'];

  it('adds one field per presenter method, on a single row', async () => {
    const out = await presentEgress({ id: '1', body: 'abcdefgh', authorId: 'a' }, presenter, names);
    expect(out).toEqual({ id: '1', body: 'abcdefgh', authorId: 'a', excerpt: 'abcde', authorName: 'author:a' });
  });

  it('walks a list — and keeps a ListResult\'s own properties', async () => {
    const rows = Object.assign(
      [{ id: '1', body: 'abcdefgh', authorId: 'a' }],
      { total: 12, hasMore: true },
    );
    const out = await presentEgress(rows, presenter, names) as { total?: number; hasMore?: boolean }[];
    expect(out[0]).toMatchObject({ excerpt: 'abcde', authorName: 'author:a' });
    expect((out as unknown as { total: number }).total).toBe(12);
    expect((out as unknown as { hasMore: boolean }).hasMore).toBe(true);
  });

  it('is a no-op without a presenter, and leaves scalars alone', async () => {
    expect(await presentEgress({ id: '1' }, undefined, names)).toEqual({ id: '1' });
    expect(await presentEgress({ id: '1' }, presenter, [])).toEqual({ id: '1' });
    expect(await presentEgress(true, presenter, names)).toBe(true);
    expect(await presentEgress(null, presenter, names)).toBeNull();
  });
})
