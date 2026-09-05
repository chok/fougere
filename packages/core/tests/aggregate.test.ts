/**
 * From two entities on, a repository OWNS them — and owning is the whole mechanism.
 *
 * A rule spanning two tables had nowhere to live: `InputValidator.check` sees one row, and a frame
 * makes two writes atomic without saying which ones may happen. The missing half was not a
 * checker but a DOOR — as long as `Storage<Ledger>` is handed to whoever asks, no file can
 * be the only way in. Close that, and the rule is ordinary TypeScript inside the method that
 * writes. Nothing here verifies anything; it verifies who may write.
 *
 * The arity is the declaration, second reading of what `storage.ts` states for `Storage`
 * against `Together`: a boundary between one thing and nothing is not a boundary.
 */
import { describe, it, expect, vi } from 'vitest';
import { join } from 'node:path';
import { createContainer, type Container } from '@fougere/container';
import { scanProject } from '../src/node.js';
import { createApp, createLocalRunner, Repository } from '../src/index.js';
import { repositoryKeyOf, ownedBy } from '../src/prefab/repository.js';
import { storageKeyOf, type StorageFactory } from '../src/storage.js';
import { EMPTY_INVOCATION } from '../src/wire/Invocation.js';

function makeStorage() {
  const storage = {
    list: vi.fn(async () => [] as unknown[]),
    findById: vi.fn(async () => ({ id: 'a1', holder: 'ada', balance: 1000 })),
    findBy: vi.fn(async () => undefined),
    findAllBy: vi.fn(async () => [] as unknown[]),
    findByKeys: vi.fn(async () => new Map()),
    findAllByKeys: vi.fn(async () => new Map()),
    create: vi.fn(async (input: unknown) => input),
    upsert: vi.fn(async (input: unknown) => input),
    upsertAll: vi.fn(async () => 0),
    update: vi.fn(async (_id: string, input: unknown) => input),
    delete: vi.fn(async () => true),
    output: vi.fn(() => storage),
    client: {},
  };
  return storage;
}

const storageFactory: StorageFactory = (() => makeStorage()) as unknown as StorageFactory;
const boot = async (fixture: string) =>
  createApp({ scan: await scanProject(join(import.meta.dirname, fixture)), createContainer, storageFactory });

describe('the arity is the declaration', () => {
  it('owns nothing at one, and both at two', () => {
    class Account {}
    class Ledger {}

    // One entity is a place to name questions, not a boundary — so nothing is claimed and
    // every app that already declares a repository keeps behaving exactly as before.
    expect(ownedBy(class extends Repository(Account as never) {})).toEqual([]);
    expect(ownedBy(class extends Repository(Account as never, Ledger as never) {}))
      .toEqual([Account, Ledger]);
  });
});

describe('an owned entity has no other door', () => {
  it('drops the default repository of EVERY member, not just the one it is named after', async () => {
    await using app = await boot('fixtures-aggregate');
    // Providers live in the frond's scope, which is the container a handler resolves in.
    const bank = app.resolve<Container>('frond:bank');

    // `AccountRepository` takes the key derived from its FIRST member, so `Account` was
    // already covered by `if (!scope.has(repoKey))`. `Ledger` was the hole: its default was
    // registered under a name any handler could spell, and the aggregate meant nothing.
    expect(bank.has(repositoryKeyOf('ledger'))).toBe(false);
    expect(bank.has(repositoryKeyOf('account'))).toBe(true);
    expect(bank.resolve('AccountRepository')).toBeDefined();
  });

  it('answers through the aggregate — the members are reached inside its method', async () => {
    await using app = await boot('fixtures-aggregate');
    const out = await createLocalRunner(app)({ entity: 'account', op: 'withdraw' }, EMPTY_INVOCATION);

    expect(out).toMatchObject({ holder: 'ada' });
  });

  it('refuses a handler that reaches around it, naming the owner', async () => {
    const rejected = boot('fixtures-aggregate-trap');

    await expect(rejected).rejects.toThrow(/\[aggregate\] LedgerHandler asks for LedgerStorage/);
    await expect(rejected).rejects.toThrow(/AccountRepository owns ledger/);
    await expect(rejected).rejects.toThrow(/constructor\(private ledger: AccountRepository\)/);
  });
});

describe('storage is reached through a repository, never through the port', () => {
  it('refuses a door that names the port, and points at the repository key', async () => {
    const rejected = boot('fixtures-aggregate-trap');
    await expect(rejected).rejects.toThrow(/LedgerStorage/);
  });

  it('lets a HOLDER name the port of what its prefab was built on', async () => {
    // A Mirror writes the copy it owns; naming `Storage<BookCard>` is what `Mirror(BookCard)`
    // exists for. The rule separates a door from a holder, not one directory from another —
    // which is why it covers `Mirror` without naming it.
    await using app = await boot('fixtures-holder');
    const catalog = app.resolve<Container>('frond:catalog');

    expect(catalog.resolve('PartnerCatalog')).toBeDefined();
    expect(catalog.has(storageKeyOf('bookCard'))).toBe(true);
  });

  it('lets a door depend on a class whose NAME ends in the key suffix', async () => {
    // `FileStorage` is a provider, not `file`'s rows, and the suffix alone cannot tell.
    // Without `entityOfStorageKey`'s `known`, measured: this boot is refused.
    await using app = await boot('fixtures-holder');
    const catalog = app.resolve<Container>('frond:catalog');

    // The class's own name IS the key `Storage<File>` would ask for; an app declaring both
    // would have them meet, which nothing here can tell apart.
    const files = catalog.resolve<{ path(name: string): string }>(storageKeyOf('file'));
    expect(files.path('a')).toBe('/files/a');
  });

  it('resolves a door that asks for RepositoryOf<E> with no file written', async () => {
    await using app = await boot('fixtures-holder');
    const out = await createLocalRunner(app)({ entity: 'bookCard', op: 'list' }, EMPTY_INVOCATION);

    expect(out).toEqual([]);
  });
});

describe('what the shape refuses, and what a sentence has to refuse instead', () => {
  it('refuses two aggregates over one entity, naming both', async () => {
    // The reason `ports:` refuses two implementations: whichever won would depend on scan
    // order, and one of the two boundaries would be held by nobody.
    const rejected = boot('fixtures-aggregate-twice');

    await expect(rejected).rejects.toThrow(/\[aggregate\]/);
    await expect(rejected).rejects.toThrow(/AccountRepository and LedgerRepository|LedgerRepository and AccountRepository/);
  });

  it('leaves an owned entity no automatic CRUD, and says so at boot', async () => {
    // The shape alone already refuses — `Crud(Ledger)` asks for `LedgerRepository`, which an
    // owned entity has none of. But LAZILY: measured, the app booted clean and answered every
    // request with the container's `'LedgerRepository' is not registered`. A receiver that
    // starts and then rejects everything is found in production, so it is said here.
    const rejected = boot('fixtures-aggregate-crud');

    await expect(rejected).rejects.toThrow(/\[aggregate\] LedgerHandler takes the five gestures on ledger/);
    await expect(rejected).rejects.toThrow(/which AccountRepository owns/);
    await expect(rejected).rejects.toThrow(/constructor\(private ledger: AccountRepository\)/);
  });
});
