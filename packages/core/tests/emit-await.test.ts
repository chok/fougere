/**
 * `Emit<T, A>` — an announcement that waits, and the second type is the whole declaration.
 *
 * `Emit<T>` hands the fact over and returns; `Emit<T, Verdict>` waits for every subscriber
 * and gives back what they said. No option and no mode: whether it waits is in the
 * signature, which is why a boot can refuse the one case it cannot honour.
 *
 * A subscriber says nothing new either — `Fact<T>` answering `Promise<void>` has no
 * opinion, and any other return is one.
 */
import { describe, it, expect } from 'vitest';
import { createContainer } from '@fougere/container';
import { createApp, frond } from '../src/index.js';
import { entity, text, bool, optional, created } from '@fougere/schema';

class CanBook extends entity({
  room: text({ min: 1 }),
  at: created(),
}) {}

class Verdict extends entity({
  from: text(),
  ok: bool(),
  because: optional(text()),
}) {}

const subscribing = (ctor: new () => unknown) => ({
  ctor,
  deps: [],
  operations: {
    check: {
      binding: [{ name: 'question', optional: false, source: { kind: 'fact' as const, factName: 'canBook' } }],
    },
  },
});

class Rooms {
  async check(question: CanBook): Promise<Verdict> {
    return { from: 'rooms', ok: true } as Verdict;
  }
}

class Billing {
  async check(question: CanBook): Promise<Verdict> {
    return { from: 'billing', ok: question.room !== 'atrium' } as Verdict;
  }
}

/** No opinion, and `Promise<void>` is how it says so. */
class Watching {
  async check(): Promise<void> {}
}

class Down {
  async check(): Promise<Verdict> {
    throw new Error('down');
  }
}

/** The announcer, and the second type is what makes it wait. */
const booking = {
  ctor: class BookingHandler {},
  deps: ['canBookAwait'],
  operations: {},
};

const app = (...subscribers: (new () => unknown)[]) => createApp({
  fronds: [
    frond('booking', { entities: [CanBook, Verdict], handlers: [booking] }),
    ...subscribers.map((ctor, at) => frond(`s${at}`, { handlers: [subscribing(ctor)] })),
  ],
  createContainer,
});

const announce = (built: Awaited<ReturnType<typeof app>>) =>
  built.container.resolve<(fact: unknown) => Promise<Verdict[]>>('canBookAwait');

describe('an announcement that waits', () => {
  it('gives back what every subscriber answered', async () => {
    await using built = await app(Rooms, Billing);

    const answers = await announce(built)({ room: 'library' });

    // No law combines them: the announcer has them all and decides — here, unanimity.
    expect(answers.map((one) => one.from).sort()).toEqual(['billing', 'rooms']);
    expect(answers.every((one) => one.ok)).toBe(true);
  });

  it('leaves out a subscriber that has no opinion', async () => {
    await using built = await app(Rooms, Watching);

    // `Promise<void>` is a subscriber saying nothing, not a subscriber missing. It is
    // waited for like the others — only its silence contributes nothing.
    expect(await announce(built)({ room: 'library' })).toHaveLength(1);
  });

  it('refuses the announcement when a subscriber did not answer', async () => {
    await using built = await app(Rooms, Down);

    // Not one answer out of two: an announcer handed the survivors cannot tell them from a
    // complete answer, and its own law then reads silence as consent.
    await expect(announce(built)({ room: 'atrium' }))
      .rejects.toThrow(/1 of 2 subscriber\(s\) did not answer.*check/s);
  });

  it('does not wait when the announcement declares no answer type', async () => {
    await using built = await app(Rooms);

    // The same fact, the other key: `Emit<CanBook>` hands it over and returns nothing.
    // Two functions, because they are two relationships to the same subject.
    const said = built.container.resolve<(fact: unknown) => Promise<unknown[]>>('canBookEmit');
    expect(await said({ room: 'library' })).toEqual([]);
  });

  it('refuses at boot when a carrier makes the subscribers unknowable', async () => {
    // A carrier publishes to whoever subscribed elsewhere and brings nothing back, so the
    // answers would hold this process's subscribers only. The second type is in a
    // signature, so this is a BOOT refusal rather than a partial answer at the first call.
    await expect(createApp({
      fronds: [frond('booking', { entities: [CanBook, Verdict], handlers: [booking] })],
      createContainer,
      onEmit: async () => {},
    })).rejects.toThrow(/'canBook' is announced with an answer type, and this app has a carrier/);
  });
});
