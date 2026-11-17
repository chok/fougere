/**
 * Only data crosses a frond. A facade call whose arguments carry behaviour — a function, a method on
 * a prototype — is refused before it is sent, so the same call answers the same in one process and
 * across two, where JSON would have dropped the method in silence.
 */
import { afterEach, describe, it, expect } from 'vitest';
import { createContainer } from '@fougere/container';
import { entity, primary, text } from '@fougere/schema';
import { createApp, createAppRunner, createLocalRunner, ErrorCode, frond, Invocation, type App, type Transport } from '../src/index.js';
import { behaviourIn } from '../src/wire/behaviourIn.js';
import { input, op } from './contract.js';

class Item extends entity({ id: primary(), name: text() }) {}

class StockHandler {
  async take(item: Item): Promise<string> {
    return item.name;
  }
}

let handed: unknown;

class CartHandler {
  constructor(private stock: { take(item: unknown): Promise<string> }) {}

  async give(): Promise<string> {
    return this.stock.take(handed);
  }
}

const fronds = () => [
  frond('stock', { entities: [Item], handlers: [{ ctor: StockHandler, operations: { take: op({ args: [input('item')], input: Item as never, cardinality: 'one' }) } }] }),
  frond('cart', { handlers: [{ ctor: CartHandler, deps: ['Facade<StockHandler>'], operations: { give: op({ cardinality: 'one' }) } }] }),
];

const boot = (extra: Record<string, unknown> = {}) => createApp({ createContainer, storageFactory: () => ({}) as never, fronds: fronds(), ...extra });

const acrossTheWire = (far: App): Transport => (call, invocation) =>
  createLocalRunner(far)(call, { ...JSON.parse(JSON.stringify(invocation)), fromAnotherProcess: true });

const started: App[] = [];
afterEach(async () => { for (const app of started.splice(0)) await app.dispose(); });

async function placements(): Promise<[string, (value: unknown) => Promise<unknown>][]> {
  const one = await boot();
  const far = await boot();
  const near = await boot({ remotes: { stock: 'http://stock.test' }, remoteTransport: () => acrossTheWire(far) });
  started.push(one, near, far);
  const giving = (app: App) => (value: unknown) => {
    handed = value;

    return createAppRunner(app)({ address: 'cart', op: 'give' }, Invocation.empty);
  };

  return [['one process', giving(one)], ['two processes', giving(near)]];
}

describe('only data crosses a frond', () => {
  it('refuses a method the same way at both placements', async () => {
    for (const [, give] of await placements()) {
      await expect(give({ id: 'i1', name: 'fern', shout() { return 'hey'; } }))
        .rejects.toMatchObject({ code: ErrorCode.INTERNAL_ERROR, message: expect.stringContaining("argument 1 carries behaviour at 'shout'") });
    }
  });

  it('lets a plain row through at both placements', async () => {
    for (const [, give] of await placements()) {
      await expect(give({ id: 'i1', name: 'fern' })).resolves.toBe('fern');
    }
  });
});

describe('behaviourIn', () => {
  it('reads data as data', () => {
    expect(behaviourIn({ id: 'a', at: new Date(0), tags: ['x'], nested: { n: 1 }, none: null })).toBeUndefined();
  });

  it('names where behaviour sits', () => {
    expect(behaviourIn({ nested: { run: () => 1 } })).toEqual(['nested', 'run']);
    expect(behaviourIn([{ id: 'a' }, new Map()])).toEqual(['1']);
    expect(behaviourIn(new (class Basket { total() { return 0; } })())).toEqual([]);
  });
});
