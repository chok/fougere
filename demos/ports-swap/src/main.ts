/**
 * One handler, several providers, and the single line that decides.
 *
 * `CheckoutHandler` is loaded unchanged for every run — it declares `Payment`, the port,
 * and never names a PSP. What changes is `ports:` in fougere.config.ts: which realization
 * answers (1-3), what stands IN FRONT of it (4), and the same statement one level up, on a
 * port the framework declares rather than you (5).
 */
import { createLocalRunner, Invocation, type Storage } from '@fougere/core';
import { boot } from '@fougere/compiler';
import { createContainer } from '@fougere/container';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..');

/** Rows in a Map — this demo is about who stands in front of a storage, not where rows live. */
const storageFactory = (() => {
  const rows: Record<string, unknown>[] = [];
  const storage = {
    async list() { return { items: [...rows], total: rows.length }; },
    async findById() { return undefined; },
    async findBy() { return undefined; },
    async findAllBy() { return []; },
    async findByKeys() { return new Map(); },
    async findAllByKeys() { return new Map(); },
    async create(input: Record<string, unknown>) { rows.push(input); return input; },
    async upsert(input: Record<string, unknown>) { return input; },
    async upsertAll() { return 0; },
    async update(_id: string, input: Record<string, unknown>) { return input; },
    async delete() { return true; },
    output() { return storage; },
    client: {},
  };

  return storage;
}) as unknown as () => Storage;

// `boot()` asks for the SETUP, not the factory: a host that opens a connection has to be
// able to close it, and `db:` is where both halves are stated.
const booted = (ports?: Record<string, string | readonly string[]>) =>
  boot({ root, createContainer, db: () => ({ storageFactory }), ...(ports ? { config: { ports } } : {}) });

const pay = async (ports?: Record<string, string | readonly string[]>) => {
  const app = await booted(ports);
  const out = await createLocalRunner(app)({ entity: 'checkout', op: 'pay' }, Invocation.empty);
  await app.dispose();
  return out;
};

console.log('\n1. fougere.config.ts says  ports: { Payment: \'StripePayment\' }');
console.log('   →', JSON.stringify(await pay()));

console.log('\n2. the same app, that one line changed to \'OgonePayment\'');
console.log('   →', JSON.stringify(await pay({ Payment: 'OgonePayment' })));

console.log('\n3. the line removed — two classes extend Payment and nothing says which');
try {
  await pay({});
  console.log('   → no refusal, which would be the bug this demo exists to catch');
} catch (err) {
  console.log('   →', (err as Error).message);
}

console.log('\n4. the same key says what stands IN FRONT — ports: { Payment: [\'RetryingPayment\', \'StripePayment\'] }');
console.log('   →', JSON.stringify(await pay({ Payment: ['RetryingPayment', 'StripePayment'] })));

console.log('\n5. the same statement on a port the FRAMEWORK declares — catalog/services/Recording.ts');
console.log('   it extends Storage and asks for one, and nothing else declares it:');
{
  const app = await booted({ Payment: 'StripePayment' });
  const call = createLocalRunner(app);
  // `ProductHandler` has never heard of `Recording`, and `Recording` names no entity.
  await call({ entity: 'product', op: 'add' }, { ...Invocation.empty, params: { title: 'fern' } });
  // The neighbour's rows, written the same way — and the link does not see them. The scope
  // is the FROND, so a link goes where its frond goes; `billing` behind `remotes:` would
  // lose nothing its own code mentions.
  await call({ entity: 'invoice', op: 'record' }, { ...Invocation.empty, params: { reference: 'INV-1' } });
  console.log('   billing wrote one too, and nothing stood in front of it.');
  await app.dispose();
}

console.log('\nCheckoutHandler and ProductHandler were not touched between the five.');
console.log('A link is a CLASS this process loads, so it cannot live behind `remotes:` —');
console.log('the same line `Pipe<T>` draws. What crosses a wire is a fact, not a link.\n');
