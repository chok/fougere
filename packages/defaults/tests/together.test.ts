/**
 * `Together<[…]>` — one declaration, two realizations, and a boot that says which.
 *
 * `EntityOrm` is the port whose every gesture is one statement; this is the port whose
 * unit is a block. What the tests hold is that the SAME handler gets all-or-nothing
 * either way, that only the isolation differs, and that the difference is announced
 * rather than discovered.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createApp, createLocalRunner, togetherKeyOf } from '@fougere/core';
import { EMPTY_INVOCATION } from '@fougere/core/contract';
import { createContainer } from '@fougere/container';
import { setupSqlite } from '@fougere/adapter-sql';
import { storageFrom } from '../src/storage.js';

const root = join(import.meta.dirname, 'fixtures-together');

afterEach(() => { vi.restoreAllMocks(); });

/** One app, with `Ledger` either beside `Account` or in a source of its own. */
async function boot(split: boolean) {
  const dir = mkdtempSync(join(tmpdir(), 'together-'));
  const storage = storageFrom(split
    ? {
      db: setupSqlite({ path: join(dir, 'app.db') }),
      sources: { accounting: { setup: setupSqlite({ path: join(dir, 'accounting.db') }), entities: ['Ledger'] } },
    }
    : { db: setupSqlite({ path: join(dir, 'app.db') }) });

  // What the boot SAYS is half of what is under test, so it is captured rather than read.
  // Every level, not `log` alone: a logger sends each one to its own console method, so a
  // spy on `log` would miss every `info` line — which is most of what a boot says.
  const said: string[] = [];
  const take = (...parts: unknown[]) => { said.push(parts.join(' ')); };
  const spies = (['debug', 'info', 'log', 'warn', 'error'] as const)
    .map((method) => vi.spyOn(console, method).mockImplementation(take));
  const app = await createApp({
    root,
    createContainer,
    ormFactory: storage.ormFactory,
    sourceOf: storage.sourceOf,
    transacted: storage.transacted as never,
  });
  for (const spy of spies) spy.mockRestore();
  await storage.migrate!(app);

  const orm = (entity: string) => (app as never as { ormFor(e: string): any }).ormFor(entity);
  await orm('account').create({ id: 'a', owner: 'Ada', balance: 1000 });
  await orm('account').create({ id: 'b', owner: 'Bob', balance: 0 });

  const call = createLocalRunner(app);
  return {
    said,
    orm,
    announceInside: () => call({ entity: 'transfer', op: 'moveAndAnnounceInside' },
      { ...EMPTY_INVOCATION, params: { from: 'a', to: 'b', amount: 100 } as never }),
    announceAfter: () => call({ entity: 'transfer', op: 'moveAndAnnounceAfter' },
      { ...EMPTY_INVOCATION, params: { from: 'a', to: 'b', amount: 100 } as never }),
    nest: () => call({ entity: 'nested', op: 'nest' }, EMPTY_INVOCATION),
    sync: () => call({ entity: 'refresh', op: 'sync' }, EMPTY_INVOCATION),
    syncAndFail: () => call({ entity: 'refresh', op: 'syncAndFail' }, EMPTY_INVOCATION),
    move: (amount: number) =>
      call({ entity: 'transfer', op: 'move' },
        { ...EMPTY_INVOCATION, params: { from: 'a', to: 'b', amount } as never }),
    moveAndFail: (amount: number) =>
      call({ entity: 'transfer', op: 'moveAndFail' },
        { ...EMPTY_INVOCATION, params: { from: 'a', to: 'b', amount } as never }),
    overdraw: () =>
      call({ entity: 'transfer', op: 'overdraw' },
        { ...EMPTY_INVOCATION, params: { from: 'a', to: 'b' } as never }),
    async [Symbol.asyncDispose]() {
      await app.dispose();
      await storage.close!();
      rmSync(dir, { recursive: true, force: true });
    },
  };
}

describe('the key and its dual', () => {
  it('keeps the declared order, because the callback destructures it', () => {
    // Sorting would hand `[ledger, accounts]` to a signature that says the opposite —
    // the type and the runtime disagreeing about one line.
    expect(togetherKeyOf(['Account', 'Ledger'])).toBe('Account+LedgerTogether');
    expect(togetherKeyOf(['Ledger', 'Account'])).toBe('Ledger+AccountTogether');
  });
});

describe('one source — the engine gives both', () => {
  it('says at boot that it built a transaction', async () => {
    await using app = await boot(false);
    expect(app.said.some((line) => /Account\+LedgerTogether — transaction, source 'db'/.test(line))).toBe(true);
  });

  it('takes both writes back when the block throws', async () => {
    await using app = await boot(false);
    await expect(app.moveAndFail(100)).rejects.toThrow(/boom/);

    expect((await app.orm('account').findById('a')).balance).toBe(1000);
    expect(await app.orm('ledger').list()).toHaveLength(0);
  });

  it('commits both when it does not', async () => {
    await using app = await boot(false);
    await app.move(100);

    expect((await app.orm('account').findById('a')).balance).toBe(900);
    expect((await app.orm('account').findById('b')).balance).toBe(100);
    expect(await app.orm('ledger').list()).toHaveLength(1);
  });
});

describe('two sources — the frame replays its own inverses', () => {
  it('says at boot that it compensates, and that isolation is gone', async () => {
    await using app = await boot(true);
    const line = app.said.find((l) => l.includes('Account+LedgerTogether'));
    expect(line).toMatch(/compensated/);
    expect(line).toMatch(/no isolation/);
  });

  it('takes both writes back — across two engines, with no transaction anywhere', async () => {
    await using app = await boot(true);
    await expect(app.moveAndFail(100)).rejects.toThrow(/boom/);

    // The unwind ran in reverse: the ledger line first, then each balance.
    expect((await app.orm('account').findById('a')).balance).toBe(1000);
    expect((await app.orm('account').findById('b')).balance).toBe(0);
    expect(await app.orm('ledger').list()).toHaveLength(0);
  });

  it('commits both when it does not', async () => {
    await using app = await boot(true);
    await app.move(100);

    expect((await app.orm('account').findById('a')).balance).toBe(900);
    expect(await app.orm('ledger').list()).toHaveLength(1);
  });

  it('unwinds a write the ENTITY refused, not just one the block threw on', async () => {
    // The judge sits outside the recorder, so the refused write never enters the journal —
    // and what preceded it still comes back.
    await using app = await boot(true);
    await expect(app.overdraw()).rejects.toThrow(/balance/);

    expect(await app.orm('ledger').list()).toHaveLength(0);
    expect((await app.orm('account').findById('a')).balance).toBe(1000);
  });
});

describe('a provider as a member — the mirror case', () => {
  /** The upstream a mirror pulls from, so a test decides what a page holds. */
  const upstream = async () => (await import('./fixtures-together/fronds/accounting/services/RateMirror.js')).upstream;

  it('covers a mirror\'s pages: they are written, then taken back with the rest', async () => {
    (await upstream()).pages = [[{ code: 'EUR', rate: 1 }, { code: 'USD', rate: 2 }]];
    await using app = await boot(true);

    await expect(app.syncAndFail()).rejects.toThrow(/boom/);

    // `RateMirror` never appears in the unwind's code: it writes through the port, and
    // naming it as a member is what put its ORM under the recorder.
    expect(await app.orm('rateCard').list()).toHaveLength(0);
    expect(await app.orm('ledger').list()).toHaveLength(0);
  });

  it('leaves them when nothing fails', async () => {
    (await upstream()).pages = [[{ code: 'EUR', rate: 1 }, { code: 'USD', rate: 2 }]];
    await using app = await boot(true);

    expect(await app.sync()).toEqual({ written: 2 });
    expect(await app.orm('rateCard').list()).toHaveLength(2);
  });

  it('restores a row the pull OVERWROTE, rather than deleting it', async () => {
    // The half an `upsert` hides: some rows are new, some replace a row that was there.
    // Reading the keys first is what separates them.
    (await upstream()).pages = [[{ code: 'EUR', rate: 9 }, { code: 'GBP', rate: 3 }]];
    await using app = await boot(true);
    await app.orm('rateCard').create({ code: 'EUR', rate: 1 });

    await expect(app.syncAndFail()).rejects.toThrow(/boom/);

    const rates = await app.orm('rateCard').list();
    expect(rates).toHaveLength(1);
    expect(rates[0]).toMatchObject({ code: 'EUR', rate: 1 });
  });
});

describe('announcing a fact around a frame', () => {
  it('refuses from INSIDE — dispatch cannot be taken back', async () => {
    // Announcing hands the fact to every subscriber AND to the carrier, at once. The
    // frame's writes are still provisional, so the fact would outlive them.
    await using app = await boot(false);
    await expect(app.announceInside()).rejects.toThrow(/cannot be announced inside Together/);
  });

  it('takes the writes back too — the refusal is a failure like any other', async () => {
    await using app = await boot(false);
    await app.announceInside().catch(() => undefined);

    expect((await app.orm('account').findById('a')).balance).toBe(1000);
    expect(await app.orm('ledger').list()).toHaveLength(0);
  });

  it('allows it AFTER run() returns, which is when it is true', async () => {
    await using app = await boot(false);
    await expect(app.announceAfter()).resolves.toBeTruthy();
    expect((await app.orm('account').findById('a')).balance).toBe(900);
  });

  it('refuses in a compensated frame too — the two realizations answer the same', async () => {
    await using app = await boot(true);
    await expect(app.announceInside()).rejects.toThrow(/cannot be announced inside Together/);
  });
});

describe('what a frame refuses at boot', () => {
  /** Boot a fixture and hand back whatever it refused with. */
  const bootOf = async (fixture: string, remotes?: Record<string, string>) => {
    const dir = mkdtempSync(join(tmpdir(), 'together-'));
    const storage = storageFrom({ db: setupSqlite({ path: join(dir, 'app.db') }) });
    try {
      await createApp({
        root: join(import.meta.dirname, fixture),
        createContainer,
        ormFactory: storage.ormFactory,
        sourceOf: storage.sourceOf,
        transacted: storage.transacted as never,
        remotes,
        remoteTransport: (() => ({ call: async () => ({}) })) as never,
      });
    } finally {
      await storage.close!();
      rmSync(dir, { recursive: true, force: true });
    }
  };

  it('a member whose frond is remote — there is no local storage to record or undo', async () => {
    // Not "compensate what you can": a remote frond registers no ORM here, so there is
    // nothing to write through and nothing to take back.
    await expect(bootOf('fixtures-together-remote', { accounting: 'http://elsewhere' }))
      .rejects.toThrow(/'ledger' belongs to frond 'accounting'.*remotes:/s);
  });

  it('a name that resolves to nothing — a typo, not a member to skip', async () => {
    // Skipping it would leave a frame quietly one member short, whose only symptom is
    // a write that never comes back. The message names the LIST, which the two-tuple
    // declaration makes possible: nothing has to guess what kind the name was meant to be.
    await expect(bootOf('fixtures-together-typo'))
      .rejects.toThrow(/no entity named 'Ledgre' is scanned in this app/);
  });
});

describe('a frame opened inside another', () => {
  /**
   * Refused, and the measurement is the reason: on ONE engine a second transaction on the
   * same connection waits for the first, so the nested call hung for five seconds and
   * answered nothing. Split across engines the same code returned. One declaration with two
   * behaviours, one of them a deadlock, is worse than a refusal.
   */
  it('is refused before it can hang, naming the frame that holds', async () => {
    await using app = await boot(false);
    await expect(app.nest()).rejects.toThrow(/cannot be opened inside/);
  });

  it('and the outer frame takes its own writes back, like any other failure', async () => {
    await using app = await boot(false);
    await app.nest().catch(() => undefined);
    expect((await app.orm('account').findById('a')).balance).toBe(1000);
  });

  it('answers the same when the members are split — one rule, both realizations', async () => {
    await using app = await boot(true);
    await expect(app.nest()).rejects.toThrow(/cannot be opened inside/);
  });
});
