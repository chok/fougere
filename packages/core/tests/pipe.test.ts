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
import { entity, primary, text, created } from '@fougere/schema';

const root = join(import.meta.dirname, 'fixtures-pipe');

/** The fixture pushes here — the scanner loads it through its own loader. */
const seen = () => ((globalThis as Record<string, unknown>).__seen ?? []) as { email?: unknown }[];

/** Dispatch is not delivery: the emitter returns before subscribers finish. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 60));

class Post extends entity({ id: primary(), title: text() }) {}
class PostPublished extends Post.pick('id', 'title').extend({ at: created() }) {}

/** Two links over one fact, and what each writes down about having run. */
class First {
  async set(fact: unknown): Promise<unknown> {
    ((globalThis as Record<string, unknown>).__ran as string[])?.push('first');

    return fact;
  }
}

class Second {
  async set(fact: unknown): Promise<unknown> {
    ((globalThis as Record<string, unknown>).__ran as string[])?.push('second');

    return fact;
  }
}

const finishing = (ctor: new () => unknown) => ({
  ctor,
  deps: [],
  operations: {
    set: {
      binding: [{ name: 'fact', optional: false, source: { kind: 'pipe' as const, factName: 'postPublished' } }],
    },
  },
});

/** The frond that owns the fact, and states the order when there is one to state. */
const subject = (pipes?: Record<string, string[]>) => frond('blog', {
  entities: [PostPublished],
  handlers: [{ ctor: class PostHandler {}, deps: ['postPublishedEmit'], operations: {} }],
  ...(pipes ? { pipes } : {}),
});

const links = (...ctors: (new () => unknown)[]) =>
  frond('links', { handlers: ctors.map(finishing) });

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

  it('refuses two links with no order, naming both', async () => {
    // Nothing says which of two finishes the fact, and scan order is not an answer — the
    // same refusal two implementations of a port get, and two remotes over one entity.
    await expect(createApp({ fronds: [subject(), links(First, Second)], createContainer }))
      .rejects.toThrow(/2 ops finish the fact 'postPublished'.*firstHandler\.set.*secondHandler\.set/s);
  });

  it('runs them in the order the fact\'s OWNER declared', async () => {
    (globalThis as Record<string, unknown>).__ran = [];
    await using app = await createApp({
      fronds: [subject({ postPublished: ['SecondHandler', 'FirstHandler'] }), links(First, Second)],
      createContainer,
    });

    const announce = app.container.resolve<(raw: unknown) => Promise<void>>('postPublishedEmit');
    await announce({ id: 'x', title: 'a' });
    await settle();

    // Declared backwards on purpose: the order is read, not the order they were scanned in.
    expect((globalThis as Record<string, unknown>).__ran).toEqual(['second', 'first']);
  });

  it('refuses a link its fact did not order', async () => {
    await expect(createApp({
      fronds: [subject({ postPublished: ['FirstHandler'] }), links(First, Second)],
      createContainer,
    })).rejects.toThrow(/secondHandler\.set finishes the fact 'postPublished'.*not said/s);
  });

  it('refuses a frond that orders a fact it does not own', async () => {
    // Ordering is a decision about the fact, and a decision has one owner.
    await expect(createApp({
      fronds: [subject(), frond('elsewhere', { pipes: { postPublished: ['FirstHandler'] } })],
      createContainer,
    })).rejects.toThrow(/orders the links of 'postPublished', which it does not own/);
  });
});
