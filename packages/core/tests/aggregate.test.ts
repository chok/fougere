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
import aggregate from './fixtures-aggregate/fronds.js';
import aggregateCrud from './fixtures-aggregate-crud/fronds.js';
import aggregateTrap from './fixtures-aggregate-trap/fronds.js';
import aggregateTwice from './fixtures-aggregate-twice/fronds.js';
import holder from './fixtures-holder/fronds.js';
import { describe, it, expect, vi } from 'vitest';
import { entity, primary } from '@fougere/schema';
import { createContainer, type Container } from '@fougere/container';
import { createApp, createLocalRunner, frond, Repository, type FrondDescriptor } from '../src/index.js';
import { op } from './contract.js';
import Account from './fixtures-aggregate-trap/fronds/bank/entities/Account.js';
import Ledger from './fixtures-aggregate-trap/fronds/bank/entities/Ledger.js';
import AccountRepository from './fixtures-aggregate-trap/fronds/bank/services/AccountRepository.js';
import LedgerHandler from './fixtures-aggregate-trap/fronds/bank/handlers/LedgerHandler.js';
import { ownedBy, repositoryKeyOf, seated } from '../src/prefab/Repository.js';
import { storageKeyOf } from '../src/storage/Storage.js';
import { type StorageFactory } from '../src/storage/StorageFactory.js';
import { Invocation } from '../src/wire/Invocation.js';

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

const declared: Record<string, FrondDescriptor[]> = {
  'fixtures-aggregate': aggregate,
  'fixtures-aggregate-crud': aggregateCrud,
  'fixtures-aggregate-trap': aggregateTrap,
  'fixtures-aggregate-twice': aggregateTwice,
  'fixtures-holder': holder,
};

const storageFactory: StorageFactory = (() => makeStorage()) as unknown as StorageFactory;
const boot = async (fixture: string) =>
  createApp({ fronds: declared[fixture], createContainer, storageFactory });

describe('the arity is the declaration', () => {
  it('owns nothing at one, and both at two', () => {
    class Account extends entity({ id: primary() }) {}
    class Ledger extends entity({ id: primary() }) {}

    // One entity is a place to name questions, not a boundary — so nothing is claimed and
    // every app that already declares a repository keeps behaving exactly as before.
    expect(ownedBy(seated(class extends Repository<Account> {}, [Account]))).toEqual([]);
    expect(ownedBy(seated(class extends Repository<Account, Ledger> {}, [Account, Ledger])))
      .toEqual([Account, Ledger]);
  });
});

describe('an owned entity has no other facade', () => {
  it('drops the default repository of EVERY member, not just the one it is named after', async () => {
    await using app = await boot('fixtures-aggregate');
    // Providers live in the frond's scope, which is the container a handler resolves in.
    const bank = app.resolve<Container>('frond:bank');

    expect(bank.has(repositoryKeyOf('ledger'))).toBe(false);
    expect(bank.has(repositoryKeyOf('account'))).toBe(false);
    expect(bank.resolve('AccountRepository')).toBeDefined();
  });

  it('answers through the aggregate — the members are reached inside its method', async () => {
    await using app = await boot('fixtures-aggregate');
    const out = await createLocalRunner(app)({ address: 'account', op: 'withdraw' }, Invocation.from({ params: { id: 'a1' } }));

    expect(out).toMatchObject({ holder: 'ada' });
  });

  it('refuses a handler that reaches around it, naming the owner', async () => {
    const rejected = boot('fixtures-aggregate-trap');

    await expect(rejected).rejects.toThrow(/\[aggregate-storage-reached\]/);
    await expect(rejected).rejects.toThrow(/ledger belongs to AccountRepository/);
    await expect(rejected).rejects.toThrow(/constructor\(private ledger: AccountRepository\)/);
  });

  it('refuses a handler that reaches around it through a frame', async () => {
    const rejected = createApp({ fronds: bankWith([], ['Together<[Ledger]>']), createContainer, storageFactory });

    await expect(rejected).rejects.toThrow(/\[aggregate-storage-reached\] LedgerHandler\(Together<\[Ledger\]>\)/);
    await expect(rejected).rejects.toThrow(/ledger belongs to AccountRepository/);
  });

  it('lets the owner frame its own members', async () => {
    await using app = await createApp({ fronds: bankWith(['Together<[Account, Ledger]>'], ['AccountRepository']), createContainer, storageFactory });

    expect(app.resolve<Container>('frond:bank').resolve('AccountRepository')).toBeDefined();
  });
});

/** The bank, its repository asking for `repository`, and a second handler asking for `handler`. */
function bankWith(repository: string[], handler: string[]): FrondDescriptor[] {
  return [frond('bank', {
    entities: [Account, Ledger],
    providers: [{ ctor: AccountRepository, repository: [Account, Ledger], deps: repository }],
    handlers: [{ ctor: LedgerHandler, deps: handler, operations: { all: op({ output: Ledger, cardinality: 'page' }) } }],
  })];
}

describe('storage is reached through a repository, never through the port', () => {
  it('refuses a facade that names the port, and points at the repository key', async () => {
    const rejected = boot('fixtures-aggregate-trap');
    await expect(rejected).rejects.toThrow(/Storage<Ledger>/);
  });

  it('seats a HOLDER on the rows of what it was built on', async () => {
    // A Mirror writes the copy it owns, seated on its rows like any repository — the rule
    // separates a facade from a holder, not one directory from another.
    await using app = await boot('fixtures-holder');
    const catalog = app.resolve<Container>('frond:catalog');

    expect(catalog.resolve('PartnerCatalog')).toBeDefined();
    expect(catalog.has(storageKeyOf('bookCard'))).toBe(true);
  });

  it('lets a facade depend on a class whose NAME ends in Storage', async () => {
    await using app = await boot('fixtures-holder');
    const catalog = app.resolve<Container>('frond:catalog');

    const files = catalog.resolve<{ path(name: string): string }>('FileStorage');
    expect(files.path('a')).toBe('/files/a');
  });

  it('resolves a facade that asks for Repository<E> with no file written', async () => {
    await using app = await boot('fixtures-holder');
    const out = await createLocalRunner(app)({ address: 'bookCard', op: 'list' }, Invocation.empty);

    // A page crosses as the envelope, whatever the handler answered it with.
    expect(out).toEqual({ items: [] });
  });
});

describe('what the shape refuses, and what a sentence has to refuse instead', () => {
  it('refuses two aggregates over one entity, naming both', async () => {
    // The reason `ports:` refuses two implementations: whichever won would depend on scan
    // order, and one of the two boundaries would be held by nobody.
    const rejected = boot('fixtures-aggregate-twice');

    await expect(rejected).rejects.toThrow(/\[entity-owned-twice\]/);
    await expect(rejected).rejects.toThrow(/AccountRepository and LedgerRepository|LedgerRepository and AccountRepository/);
    // A contested entity has no owner, so nothing else is judged against one: the second
    // claimant is built on what it claims and would otherwise read as reaching around the
    // first, twice over. Two entities, two refusals — not four.
    await expect(rejected).rejects.toThrow(/refused: 2 declaration/);
    await expect(rejected).rejects.not.toThrow(/aggregate-storage-reached/);
  });

  it('leaves an owned entity no automatic CRUD, and says so at boot', async () => {
    // The shape alone already refuses — `Crud(Ledger)` asks for `LedgerRepository`, which an
    // owned entity has none of. But LAZILY: measured, the app booted clean and answered every
    // request with the container's `'LedgerRepository' is not registered`. A receiver that
    // starts and then rejects everything is found in production, so it is said here.
    const rejected = boot('fixtures-aggregate-crud');

    await expect(rejected).rejects.toThrow(/\[crud-on-owned-entity\]/);
    await expect(rejected).rejects.toThrow(/belongs to AccountRepository\. Drop it/);
    await expect(rejected).rejects.toThrow(/constructor\(private ledger: AccountRepository\)/);
  });
});
