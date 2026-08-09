/**
 * Announcing a fact — one emission, N recipients, and the emitter names none of them.
 *
 * Every other call in Fougere names one interlocutor: `remotes` one address per frond,
 * `Facade<T>` one door. This is the other half. What the tests hold is that nobody
 * registers anything: a handler that declares `Emit<PostPublished>` and a handler that
 * accepts `Fact<PostPublished>` find each other because the scan read their signatures.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { join } from 'node:path';
import { createContainer } from '@fougere/container-fougere';
import { createApp, createLocalRunner, emitKeyOf, factOfEmitKey, identityCardOf } from '../src/index.js';
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

describe('a fact is judged where it lands', () => {
  beforeEach(() => { (globalThis as any).__heard = []; });

  it('refuses a payload the fact itself refuses, and the op is never called', async () => {
    await using app = await createApp({ root, createContainer });
    const door = app.facadeFor('index')!;

    // `PostPublished` picks `title: text({ min: 1 })` from Post, so an empty title is not
    // one. The scan fills no `input` from a parameter type, so this used to pass straight
    // through: a subscriber met no judge at all.
    await expect(door.reindex({ ...EMPTY_INVOCATION, body: { id: 'x', title: '' } }))
      .rejects.toThrow(/title/);
    expect(heard()).toEqual([]);
  });

  it('lets a legal fact through, decoded', async () => {
    await using app = await createApp({ root, createContainer });
    const door = app.facadeFor('index')!;

    await door.reindex({ ...EMPTY_INVOCATION, body: { id: 'ok', title: 'A fern', at: new Date().toISOString() } });
    expect(heard()).toEqual(['search:ok']);
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
          return { fronds: [{ name: 'search', doors: [{ name: 'index', ops: [{ name: 'reindex', kind: 'command' }] }], facts: [] }] };
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

describe('a fact on the identity card', () => {
  /**
   * What made a fact stop at the repository boundary.
   *
   * `PostPublished` has no handler, so it is not a door — and the card only published
   * doors. A subscriber in another repository had no way to obtain the shape and kept a
   * hand-written copy of it (`demos/emit-multirepo`), which is the drift the card exists
   * to prevent everywhere else.
   */
  it('publishes what a frond announces, next to what it serves', async () => {
    await using app = await createApp({ root, createContainer });
    const card = identityCardOf(app);

    const blog = card.fronds.find((frond) => frond.name === 'blog')!;
    expect(blog.doors.map((door) => door.name)).toEqual(['post']);
    expect(blog.facts.map((fact) => fact.name)).toEqual(['postPublished']);
    // The shape, so `sync` can write the class the subscriber would otherwise copy.
    expect(blog.facts[0].schema?.properties).toMatchObject({ title: expect.anything() });

    // A frond that only listens announces nothing — `Emit<T>` is what puts a name here,
    // never `Fact<T>`. What a process ACCEPTS is `app.listensTo()`, and it is not the card.
    expect(card.fronds.find((frond) => frond.name === 'search')!.facts).toEqual([]);
    expect(app.listensTo()).toContain('postPublished');
  });

  it('keeps a fact out of the doors, where hosting means answering', async () => {
    await using app = await createApp({ root, createContainer });
    const blog = identityCardOf(app).fronds.find((frond) => frond.name === 'blog')!;

    // Listing it as a door would claim it is callable, and the runner would answer
    // NOT_FOUND on every op — a remote router would even route calls to it.
    expect(blog.doors.some((door) => door.name === 'postPublished')).toBe(false);
  });
});

/**
 * A fact meets the same judge as everything else, and that is a DECISION.
 *
 * `deliver` is what a carrier calls, so these are facts off a wire — announced by a `blog`
 * whose copy of `PostPublished` no longer matches the subscriber's. It was tempting to
 * tolerate a stranger key here, since the sender ships on its own schedule: a fleet, a
 * multirepo or two teams live in version skew permanently, and refusing means a rolling
 * deployment breaks every listener that has not re-synced.
 *
 * Refused anyway. Tolerating would mean a reader silently ignoring a field it was meant to
 * handle, which is the failure you find six months later. If the judge refuses, that is the
 * end of it — the price is an ORDER: re-sync the readers, then ship the sender.
 *
 * These tests exist to keep that decision from being "fixed" later.
 */
describe('a sender whose copy has moved ahead', () => {
  beforeEach(() => { (globalThis as any).__heard = []; });

  it('is refused, and the refusal names the field', async () => {
    await using app = await createApp({ root, createContainer });
    const refusals: unknown[] = [];
    app.use(async (_ctx, next) => {
      try { return await next(); } catch (cause) { refusals.push(cause); throw cause; }
    });

    await app.deliver('postPublished', {
      id: '77',
      title: 'a post',
      at: new Date().toISOString(),
      author: 'a field this subscriber has never heard of',
    });
    await settle();

    expect(heard()).not.toContain('search:77');
    expect((refusals[0] as { details?: unknown[] }).details)
      .toEqual([{ path: 'author', message: 'Unknown field' }]);
  });

  /**
   * The log IS the evidence, so it is pinned like any other contract.
   *
   * A door hands its 400 back to a caller who can act on it. A fact is dispatched and not
   * delivered, so nothing travels back and this line is all anyone gets — a bare error
   * dump would leave the most likely cause (a copy older than the sender's) unsaid.
   */
  it('says so in a log that names the field and the remedy', async () => {
    await using app = await createApp({ root, createContainer });
    const written: string[] = [];
    const spy = vi.spyOn(console, 'error').mockImplementation((...args) => {
      written.push(args.map(String).join(' '));
    });

    try {
      await app.deliver('postPublished', {
        id: '80', title: 'a post', at: new Date().toISOString(), author: 'unknown here',
      });
      await settle();
    } finally {
      spy.mockRestore();
    }

    const line = written.find((entry) => entry.includes('postPublished → indexHandler.reindex'));
    expect(line).toMatch(/author: Unknown field/);
    expect(line).toMatch(/fougere sync/);
  });

  it('leaves the emitter untouched — a refusal reaches a log, never back up', async () => {
    await using app = await createApp({ root, createContainer });

    // Dispatch is not delivery. Whatever a subscriber decides about the payload, the
    // announcement settles: this is the same rule a throwing subscriber already obeys.
    await expect(
      app.deliver('postPublished', { id: '78', title: 'x', at: new Date().toISOString(), author: 'y' }),
    ).resolves.toBeUndefined();
  });

  /** The other direction was never in question: a field that left is missing data. */
  it('refuses a fact that lost a field it needs', async () => {
    await using app = await createApp({ root, createContainer });

    await app.deliver('postPublished', { id: '79' });
    await settle();

    expect(heard()).not.toContain('search:79');
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
