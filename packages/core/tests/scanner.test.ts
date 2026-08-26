import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { scanProject } from '../src/node.js';
import { lowerFirst } from '../src/contract.js';

const fixturesRoot = join(import.meta.dirname, 'fixtures');

describe('lowerFirst', () => {
  it('lowercases the first character', () => {
    expect(lowerFirst('OrderService')).toBe('orderService');
    expect(lowerFirst('X')).toBe('x');
    expect(lowerFirst('ProductRepository')).toBe('productRepository');
  });
});

describe('scanProject', () => {
  it('returns empty fronds when fronds/ does not exist', async () => {
    const result = await scanProject('/tmp/nonexistent-fougere-test');
    expect(result.fronds).toEqual([]);
  });

  it('discovers fronds from fronds/ directory', async () => {
    const result = await scanProject(fixturesRoot);
    const names = result.fronds.map((f) => f.name).sort();
    expect(names).toEqual(['catalog', 'inventory', 'orders']);
  });

  it('discovers services', async () => {
    const result = await scanProject(fixturesRoot);
    const orders = result.fronds.find((f) => f.name === 'orders')!;
    expect(orders.providers.map((p) => p.ctor.name)).toContain('OrderService');
  });

  it('discovers repositories', async () => {
    const result = await scanProject(fixturesRoot);
    const orders = result.fronds.find((f) => f.name === 'orders')!;
    expect(orders.providers.map((p) => p.ctor.name)).toContain('OrderRepository');
  });

  // Two directories, one list: where a provider was found is not recorded, because
  // nothing ever decided on it. DI resolves by type either way.
  it('services/ and repositories/ land in the same provider list', async () => {
    const result = await scanProject(fixturesRoot);
    const orders = result.fronds.find((f) => f.name === 'orders')!;
    expect(orders.providers.map((p) => p.ctor.name).sort()).toEqual(['OrderRepository', 'OrderService']);
  });

  it('stores the constructor from default export', async () => {
    const result = await scanProject(fixturesRoot);
    const catalog = result.fronds.find((f) => f.name === 'catalog')!;
    const product = catalog.providers.find((p) => p.ctor.name === 'ProductService')!;
    expect(typeof product.ctor).toBe('function');
    expect(product.ctor.name).toBe('ProductService');
  });

  it('discovers entities from entities/ directory', async () => {
    const result = await scanProject(fixturesRoot);
    const catalog = result.fronds.find((f) => f.name === 'catalog')!;
    const entityNames = catalog.entities.map((e) => e.name).sort();
    expect(entityNames).toEqual(['brand', 'product']);
  });

  it('stores the entity class with getFields()', async () => {
    const result = await scanProject(fixturesRoot);
    const catalog = result.fronds.find((f) => f.name === 'catalog')!;
    const product = catalog.entities.find((e) => e.name === 'product')!;
    expect(typeof product.entityClass.getFields).toBe('function');
    expect(product.entityClass.getFields()).toHaveProperty('id');
  });

  it('returns empty entities for fronds without entities/ dir', async () => {
    const result = await scanProject(fixturesRoot);
    const orders = result.fronds.find((f) => f.name === 'orders')!;
    expect(orders.entities).toEqual([]);
  });

  it('discovers handlers from handlers/ directory', async () => {
    const result = await scanProject(fixturesRoot);
    const catalog = result.fronds.find((f) => f.name === 'catalog')!;
    expect(catalog.handlers).toHaveLength(1);
    expect(catalog.handlers[0].address).toBe('product');
    expect(catalog.handlers[0].name).toBe('productHandler');
  });

  it('operations contains all operations with signatures', async () => {
    const result = await scanProject(fixturesRoot);
    const catalog = result.fronds.find((f) => f.name === 'catalog')!;
    const handler = catalog.handlers[0];

    // CRUD ops detected
    expect(handler.operations.has('list')).toBe(true);
    expect(handler.operations.has('findById')).toBe(true);

    // Op with schema resolution
    expect(handler.operations.has('search')).toBe(true);
    const search = handler.operations.get('search')!;
    expect(typeof search.input?.getFields).toBe('function');
    expect(typeof search.output?.getFields).toBe('function');
    expect(search.input!.getFields()).toHaveProperty('name');
    expect(search.output!.getFields()).toHaveProperty('id');
  });

  it('returns empty handlers for fronds without handlers/ dir', async () => {
    const result = await scanProject(fixturesRoot);
    const orders = result.fronds.find((f) => f.name === 'orders')!;
    expect(orders.handlers).toEqual([]);
  });

  it('discovers presenters from presenters/ directory', async () => {
    const result = await scanProject(fixturesRoot);
    const catalog = result.fronds.find((f) => f.name === 'catalog')!;
    expect(catalog.presenters).toHaveLength(1);
    expect(catalog.presenters[0].entityName).toBe('product');
  });

  it('detects computed field names from presenter methods', async () => {
    const result = await scanProject(fixturesRoot);
    const catalog = result.fronds.find((f) => f.name === 'catalog')!;
    const presenter = catalog.presenters[0];
    expect(presenter.fields).toContain('displayPrice');
    expect(presenter.fields).toContain('isExpensive');
    expect(presenter.fields).not.toContain('constructor');
  });

  it('infers return types from presenter method signatures', async () => {
    const result = await scanProject(fixturesRoot);
    const catalog = result.fronds.find((f) => f.name === 'catalog')!;
    const presenter = catalog.presenters[0];
    const displayPrice = presenter.fieldMeta.find((m) => m.name === 'displayPrice')!;
    const isExpensive = presenter.fieldMeta.find((m) => m.name === 'isExpensive')!;
    expect(displayPrice.returnType).toBe('string');
    expect(isExpensive.returnType).toBe('boolean');
  });

  /**
   * A computed field is handed the page and answers one value per row, so the outer array
   * level of its return type is the page — what is left is the field's own arity. Nothing
   * measured that remainder, so `string[][]` read exactly like `string[]` and every
   * projection announced a lone value for a field carrying several.
   */
  it('tells a computed list from a computed scalar', async () => {
    const result = await scanProject(join(import.meta.dirname, 'fixtures-presenter-reader'));
    const listes = result.fronds.find((f) => f.name === 'listes')!;
    const meta = (name: string) => listes.presenters[0].fieldMeta.find((m) => m.name === name)!;

    expect(meta('tags')).toMatchObject({ returnType: 'string', list: true });
    expect(meta('canEdit')).toMatchObject({ returnType: 'boolean', list: false });
  });

  it('returns empty presenters for fronds without presenters/ dir', async () => {
    const result = await scanProject(fixturesRoot);
    const orders = result.fronds.find((f) => f.name === 'orders')!;
    expect(orders.presenters).toEqual([]);
  });

  // ── Crud inheritance ────────────────────────

  it('parses inherited CRUD methods from Crud(Entity) mixin', async () => {
    const result = await scanProject(fixturesRoot);
    const inventory = result.fronds.find((f) => f.name === 'inventory')!;
    const itemHandler = inventory.handlers.find((h) => h.address === 'item')!;

    // All 5 CRUD ops should have signatures (inherited from Crud mixin)
    expect(itemHandler.operations.has('list')).toBe(true);
    expect(itemHandler.operations.has('findById')).toBe(true);
    expect(itemHandler.operations.has('create')).toBe(true);
    expect(itemHandler.operations.has('update')).toBe(true);
    expect(itemHandler.operations.has('delete')).toBe(true);

    // Signatures should exist (not just names — actual parsed params)
    const create = itemHandler.operations.get('create')!;
    expect(create.signature).toBeDefined();
    expect(create.signature!.params.length).toBeGreaterThan(0);
  });

  it('resolves T → entity class in inherited CRUD operations', async () => {
    const result = await scanProject(fixturesRoot);
    const inventory = result.fronds.find((f) => f.name === 'inventory')!;
    const itemHandler = inventory.handlers.find((h) => h.address === 'item')!;

    // create(input: T) → T resolved to Item → meta.input = Item entity
    const create = itemHandler.operations.get('create')!;
    expect(create.input).toBeDefined();
    expect(typeof create.input!.getFields).toBe('function');
    expect(create.input!.getFields()).toHaveProperty('name');

    // Output should also resolve (create returns T = Item)
    expect(create.output).toBeDefined();
    expect(create.output!.getFields()).toHaveProperty('id');
  });

  it('child methods override inherited ones', async () => {
    const result = await scanProject(fixturesRoot);
    const inventory = result.fronds.find((f) => f.name === 'inventory')!;
    const stockHandler = inventory.handlers.find((h) => h.address === 'stock')!;

    // StockHandler overrides list() — should use child signature (no params, returns Item[])
    const list = stockHandler.operations.get('list')!;
    expect(list.signature).toBeDefined();
    expect(list.signature!.params).toHaveLength(0); // child's list() has no params

    // Inherited ops still present
    expect(stockHandler.operations.has('findById')).toBe(true);
    expect(stockHandler.operations.has('create')).toBe(true);

    // Custom op from child
    expect(stockHandler.operations.has('searchStock')).toBe(true);
    const search = stockHandler.operations.get('searchStock')!;
    expect(search.input).toBeDefined();
    expect(typeof search.input!.getFields).toBe('function');
  });
});

// ── The frond's name ────────────────────────

describe('frond naming', () => {
  const nameRoot = join(import.meta.dirname, 'fixtures-frond-name');

  it('names a frond after its directory when nothing says otherwise', async () => {
    const result = await scanProject(nameRoot);
    const plain = result.fronds.find((f) => f.source.path.endsWith('plain'))!;
    expect(plain.name).toBe('plain');
    expect(plain.source.package).toBe('@fronds/plain');
  });

  /**
   * The one thing the directory cannot say. `fronds/blog-v2/` still serves the frond
   * called `blog`, so renaming on disk does not rename the entity keys, the `@fronds/*`
   * import, or a `remotes:` entry pointing at it.
   */
  it('honours `fougere.frond` in package.json as a rename', async () => {
    const result = await scanProject(nameRoot);
    const renamed = result.fronds.find((f) => f.source.path.endsWith('blog-v2'))!;
    expect(renamed.name).toBe('blog');
    expect(renamed.source.package).toBe('@fronds/blog');
    expect(renamed.entities.map((e) => e.name)).toEqual(['note']);
  });

  it('filters on the declared name, not the directory', async () => {
    const result = await scanProject(nameRoot, ['blog']);
    expect(result.fronds.map((f) => f.name)).toEqual(['blog']);
  });
});

// ── The root frond ──────────────────────────

/**
 * A single-domain app has no `fronds/` at all: the project root carries the convention
 * and IS the frond. `fronds/` is not the definition, it is where the others live — so
 * the root frond stays put when a second domain appears.
 */
describe('the root frond', () => {
  const rootFixtures = join(import.meta.dirname, 'fixtures-root-frond');

  it('scans the project root as a frond named after its directory', async () => {
    const result = await scanProject(join(rootFixtures, 'shop'));
    expect(result.fronds.map((f) => f.name)).toEqual(['shop']);

    const shop = result.fronds[0]!;
    expect(shop.source.path).toBe(join(rootFixtures, 'shop'));
    expect(shop.source.package).toBe('@fronds/shop');
    expect(shop.entities.map((e) => e.name)).toEqual(['product']);
    expect(shop.handlers.map((h) => h.address)).toEqual(['product']);
  });

  it('keeps the root frond when a second domain arrives under fronds/', async () => {
    const result = await scanProject(join(rootFixtures, 'mixed'));
    // The app's own domain first, then the ones it took in.
    expect(result.fronds.map((f) => f.name)).toEqual(['mixed', 'billing']);
    expect(result.fronds[0]!.source.path).toBe(join(rootFixtures, 'mixed'));
    expect(result.fronds[1]!.entities.map((e) => e.name)).toEqual(['invoice']);
  });

  it('honours `fougere.frond` on the root package.json too', async () => {
    const result = await scanProject(join(rootFixtures, 'renamed'));
    expect(result.fronds.map((f) => f.name)).toEqual(['shop']);
    expect(result.fronds[0]!.source.package).toBe('@fronds/shop');
  });

  /** `entities/` is the test — `services/` is an ordinary top-level name elsewhere. */
  it('does not conjure a frond from a root services/ alone', async () => {
    const result = await scanProject(join(rootFixtures, 'no-entities'));
    expect(result.fronds).toEqual([]);
  });

  it('leaves a project that keeps everything under fronds/ untouched', async () => {
    const result = await scanProject(fixturesRoot);
    expect(result.fronds.map((f) => f.name).sort()).toEqual(['catalog', 'inventory', 'orders']);
  });
});
