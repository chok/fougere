/**
 * What a NARROW type in an operation's signature actually gets handed.
 *
 * `gardes-par-signature` proposes that a rule live on the operation, spelled as a
 * tighter type in the signature — `charge(amount: Cents)` rather than a guard in the
 * body. This file measures where that proposal starts from, because designing against
 * an unmeasured starting point is how you design the wrong thing.
 *
 * The fixture is two methods with the SAME body, `amount * 2`, differing only in how
 * the parameter's type is written. What changes is not the arithmetic, it is where the
 * value comes from:
 *
 *   - `amount: number` binds BY NAME, from the route params or the query string.
 *   - `amount: Cents` — an alias that is a number at runtime — binds to the whole
 *     request body, so `amount * 2` is `NaN` and nothing says a word.
 *
 * It is not enforced and not refused: the alias falls through `computeBindingPlan`'s
 * last branch, "everything else, body". That is the same branch as the collector known
 * issue (`binding.ts`, branch 4), where a parameter typed with an entity its frond has
 * no collector for receives the caller's body. Two symptoms, one fall-through, both silent.
 *
 * This began as a probe that asserted nothing and printed to stderr. What it found was
 * worth keeping; the printing is assertions now, because a measurement nobody can
 * re-run is just a memory.
 */
import { describe, expect, it } from 'vitest';
import { join } from 'node:path';
import { createContainer } from '@fougere/container';
import { createApp, createLocalRunner } from '../src/index.js';

const root = join(import.meta.dirname, 'fixtures-narrow-signature');

async function billing() {
  const app = await createApp({ root, createContainer });
  const run = createLocalRunner(app);
  const call = (op: string, invocation: Record<string, unknown>) =>
    run({ entity: 'invoice', op }, { params: {}, query: {}, body: undefined, state: {}, ...invocation } as never);
  return { app, call };
}

describe('a narrow type in an operation signature', () => {
  it('reaches the framework: the scan records the name that was written', async () => {
    const { app } = await billing();
    const ops = app.fronds[0]!.handlers[0]!.operations;
    const typeOf = (op: string) => ops.get(op)?.signature?.params?.[0]?.type?.name;

    // Nothing is lost at the AST — which is what makes the proposal buildable at all.
    expect(typeOf('doublePlain')).toBe('number');
    expect(typeOf('doubleCents')).toBe('Cents');

    await app.dispose();
  });

  it('binds a plain parameter by NAME, from the params or the query', async () => {
    const { app, call } = await billing();

    // A string arrives and the arithmetic coerces it — the binding carries no type,
    // only a name. That is a separate matter from this file's subject, and it is why
    // `'1500' * 2` reads as a success here.
    expect(await call('doublePlain', { params: { amount: '1500' } })).toBe(3000);
    expect(await call('doublePlain', { query: { amount: '1500' } })).toBe(3000);

    await app.dispose();
  });

  it('never looks in the body for a plain parameter', async () => {
    const { app, call } = await billing();
    expect(await call('doublePlain', { body: { amount: 1500 } })).toBeNaN();
    await app.dispose();
  });

  it('hands an ALIAS the whole body, wherever the value actually is', async () => {
    const { app, call } = await billing();

    // Declared `amount: Cents`, received `{ amount: 1500 }` — an object times two.
    expect(await call('doubleCents', { body: { amount: 1500 } })).toBeNaN();

    // And the name it was given is ignored: params and query are not consulted at all,
    // so the same call that feeds `doublePlain` feeds this one `undefined`.
    expect(await call('doubleCents', { params: { amount: '1500' } })).toBeNaN();
    expect(await call('doubleCents', { query: { amount: '1500' } })).toBeNaN();

    await app.dispose();
  });
});
