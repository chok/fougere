import { describe, it, expect, vi } from 'vitest';
import { createContainer } from '@fougere/container';
import { createApp, createLocalRunner, frond, Invocation } from '../src/index.js';
import fronds from './fixtures/fronds.js';
import TrapHandler from './fixtures-ctor-trap/fronds/shop/handlers/ItemHandler.js';
import TrapItem from './fixtures-ctor-trap/fronds/shop/entities/Item.js';
import type { Container } from '@fougere/container';
import type { StorageFactory, Storage } from '../src/index.js';


/**
 * A stand-in for the per-entity storage. `output()` was the missing one — every copy of
 * this fake declared the five ops and forgot that the port also lets a caller scope
 * reads to a view. Answering `this` is what the real one does when nothing narrows.
 */
function fakeStorage(overrides: Partial<Storage> = {}): Storage {
  const storage: Storage = {
    list: vi.fn(async () => []),
    findById: vi.fn(async () => undefined),
    findBy: vi.fn(async () => undefined),
    findAllBy: vi.fn(async () => []),
    findByKeys: vi.fn(async () => new Map()),
    findAllByKeys: vi.fn(async () => new Map()),
    upsert: vi.fn(async (i: any) => i),
    upsertAll: vi.fn(async (rows: any[]) => rows.length),
    create: vi.fn(async () => ({})),
    update: vi.fn(async () => ({})),
    delete: vi.fn(async () => true),
    client: undefined,
    output: () => storage,
    ...overrides,
  };

  return storage;
}

describe('createApp', () => {
  it('registers builtins', async () => {
    await using app = await createApp({ fronds, createContainer, storageFactory: () => fakeStorage() });
    expect(app.container.has('Logger')).toBe(true);
  });

  it('discovers fronds', async () => {
    await using app = await createApp({ fronds, createContainer, storageFactory: () => fakeStorage() });
    const names = app.fronds.map((f) => f.name).sort();
    expect(names).toEqual(['catalog', 'inventory', 'orders']);
  });

  it('registers frond scopes accessible from root', async () => {
    await using app = await createApp({ fronds, createContainer, storageFactory: () => fakeStorage() });
    const ordersScope = app.resolve<Container>('frond:orders');
    expect(ordersScope).toBeDefined();
    expect(ordersScope.has('OrderService')).toBe(true);
    expect(ordersScope.has('OrderRepository')).toBe(true);
  });

  it('resolves providers from frond scope with builtins', async () => {
    await using app = await createApp({ fronds, createContainer, storageFactory: () => fakeStorage() });
    const ordersScope = app.resolve<Container>('frond:orders');
    const service = ordersScope.resolve('OrderService');
    expect(service).toBeDefined();
  });

  it('boots with no frond at all', async () => {
    await using app = await createApp({
      fronds: [],
      createContainer,
    });
    expect(app.fronds).toEqual([]);
    expect(app.container.has('Logger')).toBe(true);
  });

  it('refuses an app that states nothing and declares nothing else', async () => {
    // The condition is the KEY, not the frond count: the case above states none,
    // and boots. An auth provider satisfies it too — it brings entities of its own.
    await expect(createApp({ createContainer })).rejects.toThrow(/needs `fronds:`/);
  });

  it('resolve shortcut delegates to container', async () => {
    await using app = await createApp({ fronds, createContainer, storageFactory: () => fakeStorage() });
    const logger = app.resolve('Logger');
    expect(logger).toBeDefined();
  });
});

describe('createApp + storageFactory', () => {
  it('registers Storage for every entity', async () => {
    const storage = fakeStorage();
    const storageFactory: StorageFactory = vi.fn(() => storage);

    await using app = await createApp({ fronds, createContainer, storageFactory });
    const catalogScope = app.resolve<Container>('frond:catalog');

    // Both entities get an storage
    expect(catalogScope.has('Storage<Product>')).toBe(true);
    expect(catalogScope.has('Storage<Brand>')).toBe(true);
    // What is registered wraps the factory's storage — writes are validated on the way to
    // storage — so the factory's own ops are reached through it, not identical to it.
    const brandStorage = catalogScope.resolve<Storage>('Storage<Brand>');
    await brandStorage.list();
    expect(storage.list).toHaveBeenCalled();
  });

  it('calls storageFactory for every entity', async () => {
    const storage = fakeStorage();
    const storageFactory: StorageFactory = vi.fn(() => storage);

    await using app = await createApp({ fronds, createContainer, storageFactory });

    // Should have been called for Brand, Item, and Product
    expect(storageFactory).toHaveBeenCalledTimes(3);
    const names = (storageFactory as any).mock.calls.map((c: any) => c[1]).sort();
    expect(names).toEqual(['brand', 'item', 'product']);
  });

  it('refuses the boot when no storageFactory leaves a handler without its repository', async () => {
    await expect(createApp({ fronds, createContainer }))
      .rejects.toThrow(/ProductHandler asks for Repository<Product>/);
  });
});

describe('handler facades', () => {
  it('registers handler facades in root container', async () => {
    const storage = fakeStorage();
    const storageFactory: StorageFactory = vi.fn(() => storage);

    await using app = await createApp({ fronds, createContainer, storageFactory });

    expect(app.container.has('Facade<ProductHandler>')).toBe(true);
    // Brand is an entity with no handler — a shape, not a surface.
    expect(app.container.has('Facade<BrandHandler>')).toBe(false);
  });

  it('handler facade respects operations whitelist', async () => {
    const storage = fakeStorage();
    const storageFactory: StorageFactory = vi.fn(() => storage);

    await using app = await createApp({ fronds, createContainer, storageFactory });

    // ProductHandler has static operations = ['list', 'findById']
    const productHandler = app.resolve<Record<string, Function>>('Facade<ProductHandler>');
    expect(productHandler.list).toBeDefined();
    expect(productHandler.findById).toBeDefined();
    expect(productHandler.create).toBeUndefined();
    expect(productHandler.update).toBeUndefined();
    expect(productHandler.delete).toBeUndefined();
  });

  it('an entity with no handler declares no operation, so it exposes none', async () => {
    const storage = fakeStorage();
    const storageFactory: StorageFactory = vi.fn(() => storage);

    await using app = await createApp({ fronds, createContainer, storageFactory });

    // Brand is scanned, gets its storage, and answers nothing: exposing it would be
    // the framework deciding, for the author, that its rows are public.
    expect(app.resolve<Container>('frond:catalog').has('Storage<Brand>')).toBe(true);
    expect(app.container.has('Facade<BrandHandler>')).toBe(false);
    expect(() => app.resolve('Facade<BrandHandler>')).toThrow();
    expect(storage.list).not.toHaveBeenCalled();
  });

  it('handler facade delegates to the storage', async () => {
    const storage = fakeStorage({
      list: vi.fn(async () => [{ id: '1' }]),
      findById: vi.fn(async () => ({ id: '1' })),
    });
    const storageFactory: StorageFactory = vi.fn(() => storage);

    await using app = await createApp({ fronds, createContainer, storageFactory });
    // ItemHandler extends Repository<Item> — it declares the five by inheriting them.
    const itemHandler = app.resolve<Record<string, Function>>('Facade<ItemHandler>');

    const page = await itemHandler.list();
    expect(page).toEqual({ items: [{ id: '1' }] });
    expect(storage.list).toHaveBeenCalled();
  });

  it('handler facade delegates to custom service when it exists', async () => {
    const storage = fakeStorage({ list: vi.fn(async () => [{ id: 'from-storage' }]) });
    const storageFactory: StorageFactory = vi.fn(() => storage);

    await using app = await createApp({ fronds, createContainer, storageFactory });

    // Product has a custom ProductService → handler is instantiated with service as delegate
    const productHandler = app.resolve<Record<string, Function>>('Facade<ProductHandler>');
    expect(productHandler.list).toBeDefined();
    expect(productHandler.findById).toBeDefined();
  });
});

/**
 * A handler extending `Repository` takes what its constructor asks for, and the rows from the seat
 * after it — and one nothing seats is refused at boot, since TypeScript erased which entity it was.
 */
describe('a handler that extends Repository and declares a constructor', () => {
  it('is handed its own dependencies and the rows, in that order', async () => {
    await using app = await createApp({
      fronds: [frond('shop', { entities: [TrapItem], handlers: [{ ctor: TrapHandler, repository: TrapItem, deps: ['Logger'] }] })],
      createContainer,
      storageFactory: () => fakeStorage({ list: vi.fn(async () => [{ id: '1' }]) }),
    });

    expect(await createLocalRunner(app)({ address: 'item', op: 'list' }, Invocation.empty)).toEqual({ items: [{ id: '1' }] });
  });

  it('is refused when nothing says which entity, naming the line to write', async () => {
    const boot = createApp({
      fronds: [frond('shop', { entities: [TrapItem], handlers: [{ ctor: TrapHandler, deps: ['Logger'] }] })],
      createContainer,
      storageFactory: () => fakeStorage(),
    });
    await expect(boot).rejects.toThrow(/ItemHandler extends Repository, and nothing says which entity/);
    await expect(boot).rejects.toThrow(/\{ ctor: ItemHandler, repository: Item \}/);
  });
});
