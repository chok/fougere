import { afterEach, describe, expect, it, vi } from 'vitest';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import SyncHandler from '../fronds/scaffold/handlers/SyncHandler.js';
import VerifyHandler from '../fronds/scaffold/handlers/VerifyHandler.js';
import RemoteCard from '../fronds/scaffold/services/RemoteCard.js';
import ContractLock from '../fronds/scaffold/services/ContractLock.js';
import { breachMessage } from '@fougere/core';

const originalCwd = process.cwd();

afterEach(() => {
  process.chdir(originalCwd);
  vi.unstubAllGlobals();
});

const shape = (properties: Record<string, unknown>, required: string[] = []) => ({
  type: 'object',
  properties,
  required,
  'x-fougere-version': 1,
  'x-fougere-vendor': 'fougere',
});

/** A host that answers `rpc.discover` with the card it is given. */
function hostServing(frond: unknown): void {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(
    JSON.stringify({ result: { fronds: [frond] } }),
    { status: 200 },
  )));
}

const blogV1 = () => ({
  name: 'blog',
  doors: [{
    name: 'post',
    ops: [
      { name: 'list', kind: 'query', cardinality: 'page' },
      { name: 'publish', kind: 'command', cardinality: 'one' },
    ],
    schema: shape({ id: { type: 'string' }, title: { type: 'string' } }, ['id', 'title']),
  }],
  facts: [],
});

/** A consumer that ran `sync` against v1 — the accepted side of every case below. */
async function consumerOn(frond: unknown): Promise<string> {
  const root = mkdtempSync(join(tmpdir(), 'fougere-verify-'));
  process.chdir(root);
  hostServing(frond);
  await new SyncHandler(new RemoteCard(), new ContractLock()).execute({ name: 'blog', from: 'https://blog.test/' });
  return root;
}

const verify = () => new VerifyHandler(new RemoteCard(), new ContractLock());

describe('the accepted contract is a file in the repository', () => {
  it('sync writes it beside the config, holding the card verbatim', async () => {
    const root = await consumerOn(blogV1());

    const lock = JSON.parse(readFileSync(join(root, 'fougere.lock.json'), 'utf8'));
    expect(lock.version).toBe(1);
    expect(lock.remotes.blog.from).toBe('https://blog.test');
    // Stored verbatim: no second opinion between what was received and what is compared.
    expect(lock.remotes.blog.frond).toEqual(blogV1());
  });

  it('verify against an unchanged host reports nothing', async () => {
    await consumerOn(blogV1());
    hostServing(blogV1());

    const result = await verify().execute({});
    expect(result.empty).toBe(false);
    expect(result.remotes[0]!.answer!.breaking).toEqual([]);
  });
});

describe('what the host changed under a deployed consumer', () => {
  it('a field that is gone', async () => {
    await consumerOn(blogV1());
    const moved = blogV1();
    moved.doors[0]!.schema = shape({ id: { type: 'string' } }, ['id']);
    hostServing(moved);

    const result = await verify().execute({});
    expect(result.remotes[0]!.answer!.breaking.map(breachMessage)).toEqual(['post: title is gone']);
  });

  it('an operation that is gone', async () => {
    await consumerOn(blogV1());
    const moved = blogV1();
    moved.doors[0]!.ops = moved.doors[0]!.ops.filter((o) => o.name !== 'publish');
    hostServing(moved);

    const result = await verify().execute({});
    expect(result.remotes[0]!.answer!.breaking.map(breachMessage)).toEqual(['post.publish() is gone']);
  });

  it('a frond the host stopped serving', async () => {
    await consumerOn(blogV1());
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ result: { fronds: [] } }), { status: 200 })));

    const result = await verify().execute({});
    expect(result.remotes[0]!.answer!.breaking.map(breachMessage)).toEqual([`frond 'blog' is not served here`]);
  });

  it('a field the host ADDED never blocks — it is reported as worth a re-sync', async () => {
    await consumerOn(blogV1());
    const moved = blogV1();
    moved.doors[0]!.schema = shape(
      { id: { type: 'string' }, title: { type: 'string' }, slug: { type: 'string' } },
      ['id', 'title'],
    );
    hostServing(moved);

    const result = await verify().execute({});
    expect(result.remotes[0]!.answer!.breaking).toEqual([]);
    expect(result.remotes[0]!.answer!.additive).toHaveLength(1);
  });
});

describe('what verify refuses to conclude', () => {
  /** An outage is not a broken contract — saying so would fail a deploy for a timeout. */
  it('an unreachable host is said, not counted as a breach', async () => {
    await consumerOn(blogV1());
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('connect ECONNREFUSED'); }));

    const result = await verify().execute({});
    expect(result.remotes[0]!.answer).toBeUndefined();
    expect(result.remotes[0]!.unreachable).toMatch(/ECONNREFUSED/);
  });

  it('an empty lock is not a pass', async () => {
    process.chdir(mkdtempSync(join(tmpdir(), 'fougere-verify-')));
    expect(await verify().execute({})).toEqual({ empty: true, remotes: [] });
  });

  it('a name nobody accepted names the command that would', async () => {
    await consumerOn(blogV1());
    await expect(verify().execute({ name: 'billing' })).rejects.toThrow(/fougere sync billing --from/);
  });
});

describe('--from asks a different host the same question', () => {
  /**
   * The pre-deploy gate: the contract was accepted against dev, and the question is
   * whether production honours it. Nothing was recorded anywhere — the host is asked.
   */
  it('overrides the address recorded at sync', async () => {
    await consumerOn(blogV1());
    // The URL is declared because it is what this test reads back — an argument-less
    // mock records calls of length zero, and `calls[0][0]` then has no type.
    const fetchSpy = vi.fn(async (_url: string) => new Response(JSON.stringify({ result: { fronds: [blogV1()] } }), { status: 200 }));
    vi.stubGlobal('fetch', fetchSpy);

    const result = await verify().execute({ from: 'https://blog.production.test' });
    expect(result.remotes[0]!.from).toBe('https://blog.production.test');
    expect(fetchSpy.mock.calls[0]![0]).toBe('https://blog.production.test/_fougere/call');
  });
});

describe('the lock is a file a review reads', () => {
  it('is refused when it is not one, rather than treated as empty', async () => {
    const root = mkdtempSync(join(tmpdir(), 'fougere-verify-'));
    process.chdir(root);
    writeFileSync(join(root, 'fougere.lock.json'), '{ "version": 99 }');
    await expect(verify().execute({})).rejects.toThrow(/not a Fougere lock file/);
  });

  it('keys stay sorted, so a diff shows a contract change and nothing else', async () => {
    const root = await consumerOn(blogV1());
    const lock = new ContractLock();
    lock.accept(root, 'zeta', 'https://z.test', { name: 'zeta', doors: [], facts: [] });
    lock.accept(root, 'alpha', 'https://a.test', { name: 'alpha', doors: [], facts: [] });

    const written = JSON.parse(readFileSync(join(root, 'fougere.lock.json'), 'utf8'));
    expect(Object.keys(written.remotes)).toEqual(['alpha', 'blog', 'zeta']);
    expect(existsSync(join(root, '.fougere', 'remotes', 'blog'))).toBe(true);
  });
});
