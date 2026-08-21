/**
 * A copy of rows this app cannot query, and what a second pass costs.
 *
 * The partner is a real HTTP server started here (`src/partner.ts`): it answers pages
 * and a `?since=`, and nothing else. `PartnerCatalog extends Mirror(BookCard)` supplies
 * the pull; everything around it — the high-water mark, the judge, the upsert — belongs
 * to `Mirror` and is written nowhere in this demo.
 */
import { bootAppFromConfig } from '@fougere/defaults';
import { createLocalRunner, EMPTY_INVOCATION } from '@fougere/core';
import { rmSync } from 'node:fs';
import { join } from 'node:path';
import { startPartner } from './partner.js';

const root = join(import.meta.dirname, '..');

// A copy that survives the run would make the second pass unreadable — the first would
// already have nothing to do. A real mirror keeps its rows; a demo has to start empty.
rmSync(join(root, '.fougere', 'catalog.db'), { force: true });

const partner = await startPartner();
process.env.PARTNER_URL = partner.url;

const app = await bootAppFromConfig(root);
const call = createLocalRunner(app);
const refresh = () => call({ entity: 'catalog', op: 'refresh' }, EMPTY_INVOCATION) as Promise<{ written: number; since?: Date; ms: number }>;

const say = (label: string, r: { written: number; since?: Date }) =>
  console.log(`   → ${r.written} row(s) written, asked the partner for everything since `
    + `${r.since ? r.since.toISOString() : 'the beginning of time'}`);

console.log(`\n1. the copy is empty, so there is no high-water mark to read`);
say('first', await refresh());

console.log(`\n   the partner moves one price and adds a book`);
await new Promise((r) => setTimeout(r, 1100));
partner.change('9780132350884', 3100);
partner.add({ isbn: '9780596007126', title: 'Head First Design Patterns', author: 'Freeman', priceCents: 4100 });

console.log(`\n2. the same pass again — the mark is read off the rows already here`);
say('second', await refresh());

console.log(`\n3. a query the source could not have served — cheapest three, from the copy`);
const cheapest = await call({ entity: 'catalog', op: 'cheapest' }, EMPTY_INVOCATION) as { title: string; priceCents: number }[];
for (const book of cheapest) console.log(`   ${String(book.priceCents).padStart(5)}  ${book.title}`);

console.log(`\n4. the partner ships a row the shape refuses`);
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
