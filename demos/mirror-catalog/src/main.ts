/**
 * A copy of rows this app cannot query, and what a second pass costs.
 *
 * The partner is a real HTTP server started here (`src/partner.ts`): it answers pages
 * and a `?since=`, and nothing else — it never puts its own clock on a row. So the pull
 * and the mark belong to `PartnerCatalog`; the loop, the validator and the upsert belong
 * to `Mirror` and are written nowhere in this demo.
 */
import { bootApp } from '@fougere/defaults';
import { createLocalRunner, Invocation } from '@fougere/core';
import { rmSync } from 'node:fs';
import { join } from 'node:path';
import { startPartner } from './partner.js';

const root = join(import.meta.dirname, '..');

// A copy that survives the run would make the second pass unreadable — the first would
// already have nothing to do. A real mirror keeps its rows; a demo has to start empty.
rmSync(join(root, '.fougere', 'catalog.db'), { force: true });

const partner = await startPartner();
process.env.PARTNER_URL = partner.url;

const app = await bootApp(root);
const call = createLocalRunner(app);
const refresh = () => call({ entity: 'catalog', op: 'refresh' }, Invocation.empty) as Promise<{ written: number; since?: Date; ms: number }>;

const say = (label: string, r: { written: number; since?: Date }) =>
  console.log(`   → ${r.written} row(s) written, asked the partner for everything since `
    + `${r.since ? r.since.toISOString() : 'the beginning of time'}`);

console.log(`\n1. nothing has been pulled yet, so the pass asks for everything`);
say('first', await refresh());

console.log(`\n   the partner moves one price and adds a book`);
await new Promise((r) => setTimeout(r, 1100));
partner.change('9780132350884', 3100);
partner.add({ isbn: '9780596007126', title: 'Head First Design Patterns', author: 'Freeman', priceCents: 4100 });

console.log(`\n2. the same pass again — from the mark the first one left behind`);
say('second', await refresh());

console.log(`\n3. a query the source could not have served — findCheapest three, from the copy`);
const findCheapest = await call({ entity: 'catalog', op: 'findCheapest' }, Invocation.empty) as { title: string; priceCents: number }[];
for (const book of findCheapest) console.log(`   ${String(book.priceCents).padStart(5)}  ${book.title}`);

console.log(`\n4. the partner ships a row the shape refuses — and the mark stays put`);
await new Promise((r) => setTimeout(r, 1100));
partner.corrupt('9780134757599');
try {
  await refresh();
  console.log('   → no refusal, which would be the bug this demo exists to catch');
} catch (err) {
  console.log('   →', (err as Error).message);
}

await app.dispose();
await partner.close();
console.log('');
