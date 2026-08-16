/**
 * Parameter ORDER decides an operation's input contract, and a collected parameter can win it.
 *
 * `scanner.ts` fills `OperationContract.input` with the first parameter whose type resolves
 * to a schema, and that loop never consults the collector set — while `computeBindingPlan`,
 * a few lines away at the same boot, does. So the two agree on where a value COMES FROM and
 * disagree on what the caller is allowed to SEND.
 *
 * This is not the "collector in the wrong frond" issue (`collector-frond.test.ts`): here the
 * collector sits in the consuming frond, it binds, and the handler receives the real user.
 * The façade simply judges the body against `User` because that is what it was told the
 * contract was.
 *
 * Found by `demos/sse-live`, whose first signature was `draft(id, title, user: User | null)`
 * and which answered `title: Unknown field, name: Required` to a perfectly good draft.
 */
import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { createContainer } from '@fougere/container';
import { createApp, createLocalRunner, FougereError } from '../src/index.js';
import { EMPTY_INVOCATION } from '../src/wire/invocation.js';

const root = join(import.meta.dirname, 'fixtures-collector-input');

/** A valid Post body, and the same one for both calls. */
const body = { id: 'p1', title: 'Ferns unfurl in silence' };
const state = { user: { id: 'u-1', email: 'alice@example.com', role: 'author' } };

describe('an op whose collected parameter comes first', () => {
  it('binds both parameters correctly — the collector is not the problem', async () => {
    await using app = await createApp({ root, createContainer });

    const out = await createLocalRunner(app)(
      { entity: 'post', op: 'bodyFirst' },
      { ...EMPTY_INVOCATION, body, state },
    );

    expect(out).toEqual({ title: 'Ferns unfurl in silence', role: 'author' });
  });

  it('refuses the same body once the collected parameter is written first', async () => {
    await using app = await createApp({ root, createContainer });

    const call = createLocalRunner(app)(
      { entity: 'post', op: 'collectorFirst' },
      { ...EMPTY_INVOCATION, body, state },
    );

    // Two signatures, two sources each, identical bindings — and one of them judges
    // the caller's Post against `User`. `title` is not a field of User, and `email`
    // and `role` are fields the caller was never meant to send.
    const error = await call.then(() => undefined, (e: unknown) => e as FougereError);
    expect(error).toBeInstanceOf(FougereError);
    expect(error!.code).toBe('VALIDATION_FAILED');
    expect(error!.details).toEqual(
      expect.arrayContaining([
        { path: 'title', message: 'Unknown field' },
        { path: 'email', message: 'Required' },
        { path: 'role', message: 'Required' },
      ]),
    );
  });

  it('says nothing when no body is sent — which is why nothing had caught it', async () => {
    await using app = await createApp({ root, createContainer });

    // The façade only judges when there IS a body (`bootstrap.ts`, `schema && inv.body`),
    // so the wrong contract is invisible without one. Every collector op in this repo's
    // demos takes its arguments from the path, which is why this sat unexercised.
    const error = await createLocalRunner(app)(
      { entity: 'post', op: 'collectorFirst' },
      { ...EMPTY_INVOCATION, state },
    ).then(() => undefined, (e: unknown) => e);

    // Waved through, and then the handler met `undefined` where its signature promised
    // a `Post` — the same absence `BindingPlan.optional` was written to describe and
    // that `resolveArgs` still consults no branch for.
    expect(error).not.toBeInstanceOf(FougereError);
    expect((error as TypeError).message).toMatch(/Cannot read properties of undefined/);
  });
});
