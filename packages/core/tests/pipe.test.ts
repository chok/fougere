/**
 * `Pipe<T>` — the same fact, before it is final.
 *
 * A subscriber's answer is discarded, which is what makes a fact what happened: two readers
 * cannot be told two things. So amending has to happen BEFORE anyone is handed anything,
 * once — which is where the core already amends (`stamped`, realizing `created()`). This is
 * the declared form of that position, and the third word of a family: `Emit` announces,
 * `Fact` receives, `Pipe` finishes.
 */
import { scanProject } from '@fougere/compiler';
import { describe, it, expect, beforeEach } from 'vitest';
import { join } from 'node:path';
import { createContainer } from '@fougere/container';
import { createApp, createLocalRunner, Invocation, frond } from '../src/index.js';

const root = join(import.meta.dirname, 'fixtures-pipe');

/** The fixture pushes here — the scanner loads it through its own loader. */
const seen = () => ((globalThis as Record<string, unknown>).__seen ?? []) as { email?: unknown }[];

/** Dispatch is not delivery: the emitter returns before subscribers finish. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 60));

describe('an op that finishes a fact', () => {
  beforeEach(() => { (globalThis as Record<string, unknown>).__seen = []; });

  it('hands every subscriber what it answered, not what was announced', async () => {
    await using app = await createApp({ scan: await scanProject(root), createContainer });

    await createLocalRunner(app)({ entity: 'post', op: 'publish' }, { ...Invocation.empty, params: { id: '42' } });
    await settle();

    // `PostHandler` announced an address. `RedactHandler` set it aside, and the subscriber
    // never saw it — one link, before anyone, so there is no reader who saw both.
    expect(seen()).toHaveLength(1);
    expect(seen()[0]?.email).toBeNull();
  });

  it('still stamps what the entity says the system writes', async () => {
    await using app = await createApp({ scan: await scanProject(root), createContainer });

    await createLocalRunner(app)({ entity: 'post', op: 'publish' }, { ...Invocation.empty, params: { id: '7' } });
    await settle();

    // The core's own link runs first: `at: created()` is the entity speaking, and a
    // declared link amends what the entity already finished.
    expect((seen()[0] as { at?: unknown })?.at).toBeInstanceOf(Date);
  });

  it('refuses two ops finishing one fact, naming both', async () => {
    class First { async set(fact: unknown): Promise<unknown> { return fact; } }
    class Second { async set(fact: unknown): Promise<unknown> { return fact; } }

    const finishing = (ctor: new () => unknown) => ({
      ctor,
      deps: [],
      operations: {
        set: {
          binding: [{ name: 'fact', optional: false, source: { kind: 'pipe' as const, factName: 'postPublished' } }],
        },
      },
    });

    // Nothing says which of two finishes the fact, and scan order is not an answer — the
    // same refusal two implementations of a port get, and two remotes over one entity.
    await expect(createApp({
      fronds: [frond('a', { handlers: [finishing(First)] }), frond('b', { handlers: [finishing(Second)] })],
      createContainer,
    })).rejects.toThrow(/Two ops finish the fact 'postPublished'.*firstHandler\.set.*secondHandler\.set/s);
  });
});
