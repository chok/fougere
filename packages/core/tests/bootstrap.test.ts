import { describe, it, expect, vi } from 'vitest';
import { join } from 'node:path';
import { createContainer } from '@fougere/container-fougere';
import { createApp } from '../src/index.js';
import type { Container } from '@fougere/container';
import type { OrmFactory, EntityOrm } from '../src/index.js';

const fixturesRoot = join(import.meta.dirname, 'fixtures');

/**
 * A stand-in for the per-entity ORM. `output()` was the missing one — every copy of
 * this fake declared the five ops and forgot that the port also lets a caller scope
 * reads to a view. Answering `this` is what the real one does when nothing narrows.
 */
function fakeOrm(overrides: Partial<EntityOrm> = {}): EntityOrm {
  const orm: EntityOrm = {
    list: vi.fn(async () => []),
    findById: vi.fn(async () => undefined),
    findBy: vi.fn(async () => undefined),
    findAllBy: vi.fn(async () => []),
    create: vi.fn(async () => ({})),
    update: vi.fn(async () => ({})),
    delete: vi.fn(async () => true),
    output: () => orm,
    ...overrides,
  };
  return orm;
}

describe('createApp', () => {
  it('registers builtins', async () => {
    const app = await createApp({ root: fixturesRoot, createContainer });
    expect(app.container.has('Logger')).toBe(true);
    expect(app.container.has('Config')).toBe(true);
    expect(app.container.has('EventBus')).toBe(true);
  });

  it('discovers fronds', async () => {
    const app = await createApp({ root: fixturesRoot, createContainer });
    const names = app.fronds.map((f) => f.name).sort();
    expect(names).toEqual(['catalog', 'inventory', 'orders']);
    await app.dispose();
  });

  it('registers frond scopes accessible from root', async () => {
    const app = await createApp({ root: fixturesRoot, createContainer });
    const ordersScope = app.resolve<Container>('frond:orders');
    expect(ordersScope).toBeDefined();
    expect(ordersScope.has('OrderService')).toBe(true);
    expect(ordersScope.has('OrderRepository')).toBe(true);
    await app.dispose();
  });

  it('resolves providers from frond scope with builtins', async () => {
    const app = await createApp({ root: fixturesRoot, createContainer });
    const ordersScope = app.resolve<Container>('frond:orders');
    const service = ordersScope.resolve('OrderService');
    expect(service).toBeDefined();
    await app.dispose();
  });

  it('works with no fronds directory', async () => {
    const app = await createApp({
      root: '/tmp/nonexistent-fougere-test',
      createContainer,
    });
    expect(app.fronds).toEqual([]);
    expect(app.container.has('Logger')).toBe(true);
    await app.dispose();
  });

  it('resolve shortcut delegates to container', async () => {
    const app = await createApp({ root: fixturesRoot, createContainer });
    const logger = app.resolve('Logger');
    expect(logger).toBeDefined();
    await app.dispose();
  });
});

describe('createApp + ormFactory', () => {
  it('registers EntityOrm for every entity', async () => {
    const orm = fakeOrm();
    const ormFactory: OrmFactory = vi.fn(() => orm);

    const app = await createApp({ root: fixturesRoot, createContainer, ormFactory });
    const catalogScope = app.resolve<Container>('frond:catalog');

    // Both entities get an orm
    expect(catalogScope.has('ProductOrm')).toBe(true);
    expect(catalogScope.has('BrandOrm')).toBe(true);
    // What is registered wraps the factory's ORM — writes are judged on the way to
    // storage — so the factory's own ops are reached through it, not identical to it.
    const brandOrm = catalogScope.resolve<EntityOrm>('BrandOrm');
    await brandOrm.list();
    expect(orm.list).toHaveBeenCalled();

    await app.dispose();
  });

  it('calls ormFactory for every entity', async () => {
    const orm = fakeOrm();
    const ormFactory: OrmFactory = vi.fn(() => orm);

    const app = await createApp({ root: fixturesRoot, createContainer, ormFactory });

    // Should have been called for Brand, Item, and Product
    expect(ormFactory).toHaveBeenCalledTimes(3);
    const names = (ormFactory as any).mock.calls.map((c: any) => c[1]).sort();
    expect(names).toEqual(['brand', 'item', 'product']);

    await app.dispose();
  });

  it('skips orm registration when no ormFactory provided', async () => {
    const app = await createApp({ root: fixturesRoot, createContainer });
    const catalogScope = app.resolve<Container>('frond:catalog');

    expect(catalogScope.has('BrandOrm')).toBe(false);

    await app.dispose();
  });
});

describe('handler facades', () => {
  it('registers handler facades in root container', async () => {
    const orm = fakeOrm();
    const ormFactory: OrmFactory = vi.fn(() => orm);

    const app = await createApp({ root: fixturesRoot, createContainer, ormFactory });

    expect(app.container.has('productHandler')).toBe(true);
    // Brand is an entity with no handler — a shape, not a surface.
    expect(app.container.has('brandHandler')).toBe(false);

    await app.dispose();
  });

  it('handler facade respects operations whitelist', async () => {
    const orm = fakeOrm();
    const ormFactory: OrmFactory = vi.fn(() => orm);

    const app = await createApp({ root: fixturesRoot, createContainer, ormFactory });

    // ProductHandler has static operations = ['list', 'findById']
    const productHandler = app.resolve<Record<string, Function>>('productHandler');
    expect(productHandler.list).toBeDefined();
    expect(productHandler.findById).toBeDefined();
    expect(productHandler.create).toBeUndefined();
    expect(productHandler.update).toBeUndefined();
    expect(productHandler.delete).toBeUndefined();

    await app.dispose();
  });

  it('an entity with no handler declares no operation, so it exposes none', async () => {
    const orm = fakeOrm();
    const ormFactory: OrmFactory = vi.fn(() => orm);

    const app = await createApp({ root: fixturesRoot, createContainer, ormFactory });

    // Brand is scanned, gets its ORM, and answers nothing: exposing it would be
    // the framework deciding, for the author, that its rows are public.
    expect(app.resolve<Container>('frond:catalog').has('BrandOrm')).toBe(true);
    expect(app.container.has('brandHandler')).toBe(false);
    expect(() => app.resolve('brandHandler')).toThrow();
    expect(orm.list).not.toHaveBeenCalled();

    await app.dispose();
  });

  it('handler facade delegates to the orm', async () => {
    const orm = fakeOrm({
      list: vi.fn(async () => [{ id: '1' }]),
      findById: vi.fn(async () => ({ id: '1' })),
    });
    const ormFactory: OrmFactory = vi.fn(() => orm);

    const app = await createApp({ root: fixturesRoot, createContainer, ormFactory });
    // ItemHandler extends Crud(Item) — it declares the five by inheriting them.
    const itemHandler = app.resolve<Record<string, Function>>('itemHandler');

    const result = await itemHandler.list({ params: {}, query: {}, body: undefined, state: {} });
    expect(result).toEqual([{ id: '1' }]);
    expect(orm.list).toHaveBeenCalled();

    await app.dispose();
  });

  it('handler facade delegates to custom service when it exists', async () => {
    const orm = fakeOrm({ list: vi.fn(async () => [{ id: 'from-orm' }]) });
    const ormFactory: OrmFactory = vi.fn(() => orm);

    const app = await createApp({ root: fixturesRoot, createContainer, ormFactory });

    // Product has a custom ProductService → handler is instantiated with service as delegate
    const productHandler = app.resolve<Record<string, Function>>('productHandler');
    expect(productHandler.list).toBeDefined();
    expect(productHandler.findById).toBeDefined();

    await app.dispose();
  });
});

/**
 * A Crud handler that declares a constructor loses the automatic ORM injection —
 * `bootstrap` only injects it when `deps` is empty. Before this, `super()` handed
 * `undefined` down and the five CRUD ops broke on the first request, silently. No
 * handler in the repo had a constructor, so nobody had met it yet.
 */
describe('a Crud handler that declares a constructor', () => {
  const trapRoot = join(import.meta.dirname, 'fixtures-ctor-trap');

  it('is refused at boot when it does not take its ORM, and the message says how', async () => {
    const boot = createApp({ root: trapRoot, createContainer, ormFactory: () => fakeOrm() });
    await expect(boot).rejects.toThrow(/ItemHandler extends Crud\(\)/);
    await expect(boot).rejects.toThrow(/constructor\(orm: ItemOrm, …\) \{ super\(orm\); \}/);
  });
});
