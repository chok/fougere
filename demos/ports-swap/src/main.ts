/**
 * One handler, two providers, and the single line that decides.
 *
 * `CheckoutHandler` is loaded unchanged for all three runs — it declares `Payment`, the
 * port, and never names a PSP. What changes is `ports:` in fougere.config.ts, which the
 * third run drops entirely to show what the boot does when nothing states the choice.
 */
import { boot, createLocalRunner, EMPTY_INVOCATION } from '@fougere/core';
import { createContainer } from '@fougere/container';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..');
const pay = async (ports?: Record<string, string>) => {
  const app = await boot({ root, createContainer, ...(ports ? { config: { ports } } : {}) });
  const out = await createLocalRunner(app)({ entity: 'checkout', op: 'pay' }, EMPTY_INVOCATION);
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

console.log('\nCheckoutHandler was not touched between the three.\n');
