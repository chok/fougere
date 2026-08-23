/**
 * A narrow type retains its name, but does not acquire a provenance by accident.
 *
 * `gardes-par-signature` proposes that a rule live on the operation, spelled as a
 * tighter type in the signature — `charge(amount: Cents)` rather than a guard in the
 * body. This file measures where that proposal starts from, because designing against
 * an unmeasured starting point is how you design the wrong thing.
 *
 * The fixture is two methods with the SAME body, `amount * 2`, differing only in how
 * the parameter's type is written:
 *
 *   - `amount: number` binds BY NAME, from the route params or the query string.
 *   - `amount: Cents` has no derivable primitive provenance, so the frond states its
 *     `param` binding explicitly. The effective model then treats it exactly like the
 *     plain number instead of silently handing it the whole body.
 */
import { scanProject } from '../src/node.js';
import { describe, expect, it } from 'vitest';
import { join } from 'node:path';
import { createContainer } from '@fougere/container';
import { createApp, createLocalRunner } from '../src/index.js';

const root = join(import.meta.dirname, 'fixtures-narrow-signature');

async function billing() {
  const app = await createApp({ scan: await scanProject(root), createContainer });
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

  it('uses the explicitly resolved provenance for an alias', async () => {
    const { app, call } = await billing();

    expect(await call('doubleCents', { params: { amount: '1500' } })).toBe(3000);
    expect(await call('doubleCents', { query: { amount: '1500' } })).toBe(3000);

    // The declared source is a named parameter, never the body fallback.
    expect(await call('doubleCents', { body: { amount: 1500 } })).toBeNaN();

    await app.dispose();
  });
});
