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
import { createContainer } from '@fougere/container';
import { createApp, createLocalRunner } from '../src/index.js';
import { scanProject } from '../src/node.js';
import { emitKeyOf, factOfEmitKey } from '../src/emit.js';
import { identityCardOf } from '../src/wire/call.js';
import { EMPTY_INVOCATION } from '../src/contract/Invocation.js';

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
    await using app = await createApp({ scan: await scanProject(root), createContainer });

    await createLocalRunner(app)({ entity: 'post', op: 'publish' }, { ...EMPTY_INVOCATION, params: { id: '42' } });
    await settle();

    // Two subscribers, two fronds, no registration on either side. Order is scan order
    // and nothing promises it, so the assertion does not depend on it.
    expect(heard().sort()).toEqual(['mail:42', 'search:42']);
  });

  it('leaves the emitter untouched when a subscriber throws', async () => {
    await using app = await createApp({ scan: await scanProject(root), createContainer });

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
    await using app = await createApp({ scan: await scanProject(root), createContainer });
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
    await using app = await createApp({ scan: await scanProject(root, ['blog']), createContainer });

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
    await using app = await createApp({ scan: await scanProject(root), createContainer });
    const door = app.facadeFor('index')!;

    // `PostPublished` picks `title: text({ min: 1 })` from Post, so an empty title is not
    // one. The scan fills no `input` from a parameter type, so this used to pass straight
    // through: a subscriber met no judge at all.
    await expect(door.reindex({ ...EMPTY_INVOCATION, body: { id: 'x', title: '' } }))
      .rejects.toThrow(/title/);
    expect(heard()).toEqual([]);
  });

  it('lets a legal fact through, decoded', async () => {
    await using app = await createApp({ scan: await scanProject(root), createContainer });
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
      scan: await scanProject(root),
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
    await using app = await createApp({ scan: await scanProject(root), createContainer });
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
    await using app = await createApp({ scan: await scanProject(root), createContainer });
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
/**
 * An announcement is the moment a fact becomes real, so it is where the entity's own
 * `lifecycle.create` rules are realized — exactly what an insert is for a stored row.
 *
 * Nothing did it before: the judge declares an absent `created()` LEGAL and omits it
 * (`validation.ts`: filling the hole belongs to the storage, at the point of
 * persistence), and a fact has no storage. So a subscriber received a value missing a
 * field its own type says is there — a lie no compiler on either side can see.
 */
describe('a fact stamped at the announcement', () => {
  beforeEach(() => { (globalThis as any).__heard = []; (globalThis as any).__lastFact = undefined; });

  it('fills what the entity says the system writes', async () => {
    await using app = await createApp({ scan: await scanProject(root), createContainer });
    const announce = app.container.resolve<(fact: unknown) => Promise<void>>(emitKeyOf('PostPublished'));

    // `at: created()` — the emitter does not write it, the entity says who does.
    await announce({ id: 'z', title: 'A fern' });
    await settle();

    const arrived = (globalThis as any).__lastFact as { id: string; at: Date };
    expect(arrived.at).toBeInstanceOf(Date);
  });

  it('never re-stamps a fact that arrived from elsewhere', async () => {
    await using app = await createApp({ scan: await scanProject(root), createContainer });

    // `deliver` is the carrier's door. The sender already stamped this fact; doing it
    // again would give one fact two identities, one per process that relayed it.
    // It rejects here because `mail` fails on every fact by design — what this test
    // watches is the value that reached `search`, not the outcome.
    const at = new Date('2020-01-01T00:00:00.000Z');
    await app.deliver('postPublished', { id: 'y', title: 'A fern', at: at.toISOString() }).catch(() => {});

    expect(((globalThis as any).__lastFact as { at: Date }).at.toISOString()).toBe(at.toISOString());
  });
});

describe('a sender whose copy has moved ahead', () => {
  beforeEach(() => { (globalThis as any).__heard = []; });

  it('is refused, and the refusal names the field', async () => {
    await using app = await createApp({ scan: await scanProject(root), createContainer });

    const refused = await app.deliver('postPublished', {
      id: '77',
      title: 'a post',
      at: new Date().toISOString(),
      author: 'a field this subscriber has never heard of',
    }).catch((cause: AggregateError) => cause);

    expect(heard()).not.toContain('search:77');
    const shape = (refused as AggregateError).errors
      .find((e: { entity?: string }) => e.entity === 'index') as { details?: unknown[] };
    expect(shape.details).toEqual([{ path: 'author', message: 'Unknown field' }]);
  });

  /**
   * The log IS the evidence, so it is pinned like any other contract.
   *
   * A door hands its 400 back to a caller who can act on it. A fact is dispatched and not
   * delivered, so nothing travels back and this line is all anyone gets — a bare error
   * dump would leave the most likely cause (a copy older than the sender's) unsaid.
   */
  it('says so in a log that names the field and the remedy', async () => {
    await using app = await createApp({ scan: await scanProject(root), createContainer });
    const written: string[] = [];
    const spy = vi.spyOn(console, 'error').mockImplementation((...args) => {
      written.push(args.map(String).join(' '));
    });

    try {
      await app.deliver('postPublished', {
        id: '80', title: 'a post', at: new Date().toISOString(), author: 'unknown here',
      }).catch(() => {});
    } finally {
      spy.mockRestore();
    }

    const line = written.find((entry) => entry.includes('postPublished → indexHandler.reindex'));
    expect(line).toMatch(/author: Unknown field/);
    expect(line).toMatch(/fougere sync/);
  });

  it('leaves the ANNOUNCEMENT untouched — a refusal reaches a log, never back up', async () => {
    await using app = await createApp({ scan: await scanProject(root), createContainer });
    const announce = app.container.resolve<(fact: unknown) => Promise<void>>(emitKeyOf('PostPublished'));

    // The emission path, not `deliver`: this is the rule that protects the EMITTER, and
    // an earlier version of this test asserted it through the carrier's door, which is
    // exactly the party that must NOT be shielded.
    await expect(announce({ id: '78', title: 'x', author: 'y' })).resolves.toBeUndefined();
  });

  /** The other direction was never in question: a field that left is missing data. */
  it('refuses a fact that lost a field it needs', async () => {
    await using app = await createApp({ scan: await scanProject(root), createContainer });

    await expect(app.deliver('postPublished', { id: '79' })).rejects.toThrow(/refused it/);
    expect(heard()).not.toContain('search:79');
  });
});

/**
 * What a carrier needs from Fougere, and the whole of what Fougere owes it.
 *
 * At-least-once is retrying what failed, so a delivery that cannot report makes every
 * durability story impossible to build above it. `deliver` used to BE the announcement
 * path: it resolved before any subscriber had run and swallowed each failure into a log,
 * so a queue calling it could only ever ack blindly and lose the fact.
 *
 * The queue itself stays outside — `demos/emit-multirepo/broker.ts` is where retention
 * lives, and that is the position, not an omission.
 */
describe('a carrier that must decide whether to redeliver', () => {
  beforeEach(() => { (globalThis as any).__heard = []; });

  it('is told which listener refused, and how many', async () => {
    await using app = await createApp({ scan: await scanProject(root), createContainer });

    // `mail` throws on every fact by design, `search` accepts this one.
    const refused = await app.deliver('postPublished', {
      id: 'ack', title: 'A fern', at: new Date().toISOString(),
    }).catch((cause: AggregateError) => cause);

    expect(refused).toBeInstanceOf(AggregateError);
    expect((refused as AggregateError).message).toMatch(/1 of 2 listener\(s\) refused it/);
    expect((refused as AggregateError).message).toMatch(/digestHandler\.queue/);
    // And it says the framework is not holding it — the carrier decides.
    expect((refused as AggregateError).message).toMatch(/the carrier decides/);
    // The one that accepted still ran: a partial failure is not a rollback.
    expect(heard()).toContain('search:ack');
  });

  it('waits for the listeners rather than handing back straight away', async () => {
    await using app = await createApp({ scan: await scanProject(root), createContainer });

    // Nothing settles between the call and the assertion — no `settle()` here, which is
    // the difference from every announcement test above.
    await app.deliver('postPublished', {
      id: 'sync', title: 'A fern', at: new Date().toISOString(),
    }).catch(() => {});

    expect(heard()).toContain('search:sync');
  });
});

describe('a fact that would cause itself', () => {
  it('is refused, and the message names the ring', async () => {
    (globalThis as any).__heard = [];
    const cycleRoot = join(import.meta.dirname, 'fixtures-emit-cycle');
    await using app = await createApp({ scan: await scanProject(cycleRoot), createContainer });

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
