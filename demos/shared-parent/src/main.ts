/**
 * One frond holds what a family shares, and answers nothing itself.
 *
 *   fronds/billing/       services/Money.ts, middlewares/Audit.ts — no handlers
 *   fronds/cart/          handlers/CartHandler.ts
 *   fronds/invoice/       handlers/InvoiceHandler.ts
 *
 * Neither handler names `billing`. What says they resolve its code is one line of
 * `fougere.config.ts` — comment the nesting out and the first call answers
 * `'Money' is not registered`, which `fougere check` warns about before it happens.
 *
 *   pnpm dev
 */
import { boot } from '@fougere/compiler';
import { createContainer } from '@fougere/container';
import { createLocalRunner, Invocation } from '@fougere/core';

const app = await boot({ root: new URL('..', import.meta.url).pathname, createContainer });
const run = createLocalRunner(app);

console.log(`
  ${app.fronds.length} fronds: ${app.fronds.map((frond) => frond.name).join(', ')}
  'billing' is one of them and answers at no address — nothing can call it, so nothing
  can place it elsewhere, which is what makes inheriting from it safe at every rung.
`);

for (const entity of ['cart', 'invoice']) {
  const said = await run({ entity, op: 'quote' }, Invocation.empty);
  console.log(`  ${entity}.quote → ${String(said)}`);
}

console.log(`
  Both lines went through 'Audit', declared in 'billing' and named by neither handler —
  and it was handed billing's own 'Money', not a copy. Take the nesting out of
  fougere.config.ts: the boot still comes up, and the first call says 'Money' is not
  registered — a scope sees its parent, and without the line there is no parent.
`);

await app.dispose();
