/**
 * Announcing a fact — one emission, N recipients, and the emitter names none of them.
 *
 * Every other call in Fougere names one interlocutor: `remotes` one address per frond,
 * `Facade<T>` one door. This is the other half. What the tests hold is that nobody
 * registers anything: a handler that declares `Emit<PostPublished>` and a handler that
 * accepts `Fact<PostPublished>` find each other because the scan read their signatures.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { join } from 'node:path';
import { createContainer } from '@fougere/container-fougere';
import { createApp, createLocalRunner, emitKeyOf, factOfEmitKey } from '../src/index.js';
import { EMPTY_INVOCATION } from '../src/invocation.js';

const root = join(import.meta.dirname, 'fixtures-emit');

/** The fixtures push here — see IndexHandler for why it is not a module-level array. */
const heard = () => ((globalThis as any).__heard ?? []) as string[];

/** Dispatch is not delivery: the emitter returns before subscribers finish. */
const settle = () => new Promise((r) => setTimeout(r, 50));

describe('emitKeyOf and its dual', () => {
  it('undoes exactly what it does', () => {
    expect(factOfEmitKey(emitKeyOf('PostPublished'))).toBe('postPublished');
    expect(factOfEmitKey('postHandler')).toBeUndefined();
    // Not a key, just the suffix on its own — a fact with an empty name is not one.
    expect(factOfEmitKey('Emit')).toBeUndefined();
  });
});

describe('a fact reaching several fronds', () => {
  beforeEach(() => { (globalThis as any).__heard = []; });

  it('reaches every handler that accepts it, in fronds that declared nothing', async () => {
    await using app = await createApp({ root, createContainer });

    await createLocalRunner(app)({ entity: 'post', op: 'publish' }, { ...EMPTY_INVOCATION, params: { id: '42' } });
    await settle();

    // Two subscribers, two fronds, no registration on either side. Order is scan order
    // and nothing promises it, so the assertion does not depend on it.
    expect(heard().sort()).toEqual(['mail:42', 'search:42']);
  });

  it('leaves the emitter untouched when a subscriber throws', async () => {
    await using app = await createApp({ root, createContainer });

    // DigestHandler throws every time. The publication must not become hostage to it —
    // the EventBus this replaces did `await Promise.all(handlers)` and took the rejection.
    const out = await createLocalRunner(app)(
      { entity: 'post', op: 'publish' },
      { ...EMPTY_INVOCATION, params: { id: '7' } },
    );
    await settle();

    expect(out).toEqual({ id: '7' });
    expect(heard()).toContain('mail:7');
  });

  it('binds the fact parameter as a fact, never as the request body', async () => {
    await using app = await createApp({ root, createContainer });
    const contracts = app.container.resolve<Map<string, any>>('indexHandler:contracts');

    // `binding.ts` branch 4 would have handed this parameter whatever a caller typed.
    // The plan says what it is, and that sentence is what makes the index readable.
    expect(contracts.get('reindex')?.binding).toEqual([
      { name: 'fact', source: { kind: 'fact', factName: 'postPublished' }, optional: false },
    ]);
  });

  it('is legal to announce with nobody listening', async () => {
    // `Emit` is registered from the DEPS, not from the subscribers: a handler that
    // declares one must resolve it whether or not anybody cares.
    await using app = await createApp({ root, createContainer, fronds: ['blog'] });

    await expect(
      createLocalRunner(app)({ entity: 'post', op: 'publish' }, { ...EMPTY_INVOCATION, params: { id: '1' } }),
    ).resolves.toEqual({ id: '1' });
    await settle();
    expect(heard()).toEqual([]);
  });
});

describe('a listener that lives in another process', () => {
  it('is still dispatched to — its subscription was read here, its door answers there', async () => {
    (globalThis as any).__heard = [];
    const wire: string[] = [];

    // A frond declared remote is SCANNED — only its hosting is elsewhere. Filling the
    // subscriber index inside `buildFacade` alone left it empty under a split, and a fact
    // announced to a remote listener reached nobody, in silence. Proven by a demo, not by
    // a test, which is why this one exists.
    await using app = await createApp({
      root,
      createContainer,
      remotes: { search: 'http://127.0.0.1:9' },
      remoteTransport: () => async (call) => {
        if (call.entity === 'rpc') {
          return { fronds: [{ name: 'search', entities: [{ name: 'index', ops: [{ name: 'reindex', kind: 'command' }] }] }] };
        }
        wire.push(`${call.frond}:${call.entity}.${call.op}`);
        return undefined;
      },
    });

    await createLocalRunner(app)({ entity: 'post', op: 'publish' }, { ...EMPTY_INVOCATION, params: { id: '9' } });
    await settle();

    expect(wire).toEqual(['search:index.reindex']);
    // `mail` is still hosted here, so the same emission reached both topologies at once.
    expect(heard()).toEqual(['mail:9']);
  });
});

describe('a fact that would cause itself', () => {
  it('is refused, and the message names the ring', async () => {
    (globalThis as any).__heard = [];
    const cycleRoot = join(import.meta.dirname, 'fixtures-emit-cycle');
    await using app = await createApp({ root: cycleRoot, createContainer });

    // alpha → beta → alpha. A chain and not a depth: a diamond (A→B→D, A→C→D) stays
    // legal, only a fact that leads back to itself is refused.
    const emit = app.container.resolve<(f: unknown) => Promise<void>>(emitKeyOf('Alpha'));
    await emit({ id: 'x' });
    await settle();

    const refusal = heard().find((line) => line.startsWith('refused:'));
    expect(refusal).toMatch(/Emission cycle/);
    expect(refusal).toMatch(/alpha → beta → alpha/);
  });
});
