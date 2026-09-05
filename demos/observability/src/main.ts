/**
 * Three Fronds, three processes, one trace.
 *
 *   load ──▶ shop :4200 ──▶ catalog  :4100
 *                       └─▶ shipping :4300
 *
 * Everything here is topology and hosting. The domain code — `catalog/fronds`,
 * `shipping/fronds`, `shop/fronds` — mentions none of it: `CartHandler` asks for its two
 * neighbours by TYPE, and would run identically with all three Fronds in one process.
 *
 *   pnpm dev              # start the three
 *   pnpm load             # k6 against the shop, in stages
 *   pnpm signoz           # a collector, if you want to see it
 */
import { createApp, createLocalRunner, type Storage } from '@fougere/core';
import { scanProject, setModuleLoader, frondAliases } from '@fougere/core/node';
import { createContainer } from '@fougere/container';
import { serve, createHttpTransport } from '@fougere/transport-http';
import { createJiti } from 'jiti';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { observed } from './observe.js';
import { calls } from '@fougere/calls';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');

const CATALOG = 4100;
const SHOP = 4200;
const SHIPPING = 4300;

const jiti = createJiti(import.meta.url, {
  interopDefault: true,
  alias: await frondAliases(root),
});
setModuleLoader((filePath) => jiti.import(filePath) as Promise<Record<string, unknown>>);

/**
 * Held in memory — this demo is about what is observed, not about where data lives.
 * A real app hands `resolveStorage()` here and changes nothing else.
 */
const PRODUCTS = [
  { id: 'p1', title: 'Fern', stock: 3 },
  { id: 'p2', title: 'Moss', stock: 0 },
];

const memoryStorage = () => ({
  async list() { return PRODUCTS.map((p) => ({ ...p })); },
  async findById(id: string) { return PRODUCTS.find((p) => p.id === id); },
  async create(input: Record<string, unknown>) { return { id: 'created', ...input }; },
  async update() { throw new Error('not exercised'); },
  async delete() { return false; },
  output() { return this; },
}) as unknown as Storage;

const stopping: (() => Promise<void>)[] = [];

// ── catalog — holds Product, answers about it ───
// Observing is declared with the app, not wired onto it after the fact — so `dispose()`
// flushes the telemetry and this file no longer owes a `stop()` it could forget.
const catalog = await createApp({ scan: await scanProject(join(root, 'catalog')), createContainer, storageFactory: memoryStorage, extensions: [observed('catalog'), calls()] });
const catalogReceiver = await serve(createLocalRunner(catalog), { port: CATALOG });
stopping.push(async () => { await catalogReceiver.close(); await catalog.dispose(); });

// ── shipping — a Frond with no entity at all ────
const shipping = await createApp({ scan: await scanProject(join(root, 'shipping')), createContainer, extensions: [observed('shipping'), calls()] });
const shippingReceiver = await serve(createLocalRunner(shipping), { port: SHIPPING });
stopping.push(async () => { await shippingReceiver.close(); await shipping.dispose(); });

// ── shop — owns neither, calls both ─────────────
// This is the entire topology statement. Comment it out and the same CartHandler runs
// against local Fronds, with one span instead of three.
const shop = await createApp({
  scan: await scanProject(join(root, 'shop')),
  createContainer,
  remotes: {
    catalog: `http://127.0.0.1:${CATALOG}`,
    shipping: `http://127.0.0.1:${SHIPPING}`,
  },
  remoteTransport: (url) => createHttpTransport(url),
  extensions: [observed('shop'), calls({ panel: 4401 })],
});
const shopReceiver = await serve(createLocalRunner(shop), { port: SHOP });
stopping.push(async () => { await shopReceiver.close(); await shop.dispose(); });

console.log(`
  catalog   :${CATALOG}   product.list · product.findById · product.reserve
  shipping  :${SHIPPING}   shipment.quote · shipment.track
  shop      :${SHOP}   cart.checkout · cart.report        ← send load here

  curl -s localhost:${SHOP}/_fougere/call -H 'content-type: application/json' \\
    -d '{"jsonrpc":"2.0","id":1,"method":"cart.checkout","params":{}}'

  pnpm load    # k6, in stages — a flat rate draws flat lines
`);

const shutdown = async () => {
  // Reverse of construction. Telemetry flushes inside `dispose()` now — a span held in a
  // buffer at exit is a span nobody will ever see, and that is the extension's `down`.
  for (const stop of stopping.reverse()) await stop();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
