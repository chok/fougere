import { describe, it, expect, vi } from 'vitest';
import { join } from 'node:path';
import { createContainer } from '@fougere/container-fougere';
import { createApp } from '../src/index.js';
import type { Container } from '@fougere/container';
import type { OrmFactory } from '../src/index.js';

const fixturesRoot = join(import.meta.dirname, 'fixtures');

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
    const fakeOrm = { list: vi.fn(), findById: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() };
    const ormFactory: OrmFactory = vi.fn(() => fakeOrm);

    const app = await createApp({ root: fixturesRoot, createContainer, ormFactory });
    const catalogScope = app.resolve<Container>('frond:catalog');

    // Both entities get an orm
    expect(catalogScope.has('ProductOrm')).toBe(true);
    expect(catalogScope.has('BrandOrm')).toBe(true);
    expect(catalogScope.resolve('BrandOrm')).toBe(fakeOrm);

    await app.dispose();
  });

  it('calls ormFactory for every entity', async () => {
    const fakeOrm = { list: vi.fn(), findById: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() };
    const ormFactory: OrmFactory = vi.fn(() => fakeOrm);

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
    const fakeOrm = { list: vi.fn(), findById: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() };
    const ormFactory: OrmFactory = vi.fn(() => fakeOrm);

    const app = await createApp({ root: fixturesRoot, createContainer, ormFactory });

    expect(app.container.has('productHandler')).toBe(true);
    expect(app.container.has('brandHandler')).toBe(true);

    await app.dispose();
  });

  it('handler facade respects operations whitelist', async () => {
    const fakeOrm = {
      list: vi.fn(async () => []),
      findById: vi.fn(async () => undefined),
      create: vi.fn(async () => ({})),
      update: vi.fn(async () => ({})),
      delete: vi.fn(async () => true),
    };
    const ormFactory: OrmFactory = vi.fn(() => fakeOrm);

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

  it('handler facade exposes read-only operations when no custom handler', async () => {
    const fakeOrm = {
      list: vi.fn(async () => []),
      findById: vi.fn(async () => undefined),
      create: vi.fn(async () => ({})),
      update: vi.fn(async () => ({})),
      delete: vi.fn(async () => true),
    };
    const ormFactory: OrmFactory = vi.fn(() => fakeOrm);

    const app = await createApp({ root: fixturesRoot, createContainer, ormFactory });

    // Brand has no handler → read-only by default (secure default)
    const brandHandler = app.resolve<Record<string, Function>>('brandHandler');
    expect(brandHandler.list).toBeDefined();
    expect(brandHandler.findById).toBeDefined();
    expect(brandHandler.create).toBeUndefined();
    expect(brandHandler.update).toBeUndefined();
    expect(brandHandler.delete).toBeUndefined();

    await app.dispose();
  });

  it('handler facade delegates to the orm', async () => {
    const fakeOrm = {
      list: vi.fn(async () => [{ id: '1' }]),
      findById: vi.fn(async () => ({ id: '1' })),
      create: vi.fn(async () => ({})),
      update: vi.fn(async () => ({})),
      delete: vi.fn(async () => true),
    };
    const ormFactory: OrmFactory = vi.fn(() => fakeOrm);

    const app = await createApp({ root: fixturesRoot, createContainer, ormFactory });
    const brandHandler = app.resolve<Record<string, Function>>('brandHandler');

    const result = await brandHandler.list({ params: {}, query: {}, body: undefined, state: {} });
    expect(result).toEqual([{ id: '1' }]);
    expect(fakeOrm.list).toHaveBeenCalled();

    await app.dispose();
  });

  it('handler facade delegates to custom service when it exists', async () => {
    const fakeOrm = {
      list: vi.fn(async () => [{ id: 'from-orm' }]),
      findById: vi.fn(async () => undefined),
      create: vi.fn(async () => ({})),
      update: vi.fn(async () => ({})),
      delete: vi.fn(async () => true),
    };
    const ormFactory: OrmFactory = vi.fn(() => fakeOrm);

    const app = await createApp({ root: fixturesRoot, createContainer, ormFactory });

    // Product has a custom ProductService → handler is instantiated with service as delegate
    const productHandler = app.resolve<Record<string, Function>>('productHandler');
    expect(productHandler.list).toBeDefined();
    expect(productHandler.findById).toBeDefined();

    await app.dispose();
  });
});
