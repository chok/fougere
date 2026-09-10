/**
 * `Ask<T>` / `Answer<T>` — the dual of announcing, and the difference is that it waits.
 *
 * Both name a SUBJECT rather than a recipient. `Emit` returns nothing, so a subscriber's
 * answer is discarded; `Ask` waits for every responder and hands them all back, with no
 * law to combine them — the asker has them and decides.
 *
 * Waiting is possible because the responders are KNOWN, read from their signatures at
 * boot. A carrier makes them unknowable, which is why asking such a subject is refused.
 */
import { describe, it, expect } from 'vitest';
import { createContainer } from '@fougere/container';
import { createApp, frond } from '../src/index.js';
import { entity, text, bool, optional, created } from '@fougere/schema';

class CanBook extends entity({
  room: text({ min: 1 }),
  at: created(),
  from: optional(text()),
  ok: optional(bool()),
}) {}

/** The contract a responder declares — `Answer<CanBook>` in a statement rather than source. */
const answering = (ctor: new () => unknown) => ({
  ctor,
  deps: [],
  operations: {
    check: {
      binding: [{ name: 'question', optional: false, source: { kind: 'answer' as const, subjectName: 'canBook' } }],
    },
  },
});

class Rooms {
  async check(question: CanBook): Promise<CanBook> {
    return { ...question, from: 'rooms', ok: true } as CanBook;
  }
}

class Billing {
  async check(question: CanBook): Promise<CanBook> {
    return { ...question, from: 'billing', ok: question.room !== 'atrium' } as CanBook;
  }
}

class Silent {
  async check(): Promise<CanBook> {
    throw new Error('down');
  }
}

/** Somebody has to ASK, or nothing registers a question nobody puts. */
class BookingHandler {
  constructor(private mayBook: (question: unknown) => Promise<CanBook[]>) {}

  async reserve(room: string): Promise<CanBook[]> {
    return this.mayBook({ room });
  }
}

const booking = {
  ctor: BookingHandler,
  deps: ['canBookAsk'],
  operations: { reserve: { binding: [{ name: 'room', optional: false, source: { kind: 'param' as const, name: 'room' } }] } },
};

const asking = (...responders: (new () => unknown)[]) => createApp({
  fronds: [
    frond('booking', { entities: [CanBook], handlers: [booking] }),
    ...responders.map((ctor, at) => frond(`r${at}`, { handlers: [answering(ctor)] })),
  ],
  createContainer,
});

/** What a frond writes: it names the subject and nothing else. */
const ask = (app: Awaited<ReturnType<typeof asking>>) =>
  app.container.resolve<(question: unknown) => Promise<CanBook[]>>('canBookAsk');

describe('asking a subject', () => {
  it('waits for every responder and hands back every answer', async () => {
    await using app = await asking(Rooms, Billing);

    const answers = await ask(app)({ room: 'library' });

    // No law combines them: two answers, and what to make of them is the asker's.
    expect(answers.map((one) => one.from).sort()).toEqual(['billing', 'rooms']);
    expect(answers.every((one) => one.ok)).toBe(true);
  });

  it('stamps the question the way it stamps a fact', async () => {
    await using app = await asking(Rooms);

    const [answered] = await ask(app)({ room: 'library' });

    // `at: created()` is the entity speaking, before any responder — the same position
    // `Emissions.stamped` holds for an announcement. It comes back ENCODED, unlike a
    // fact: an answer crosses the responder's own output boundary, like any op's.
    expect(Number.isNaN(Date.parse(String(answered?.at)))).toBe(false);
  });

  it('refuses the question when a responder did not answer', async () => {
    await using app = await asking(Rooms, Silent);

    // Not two answers out of three: an asker handed the survivors cannot tell them apart
    // from a complete answer, and its own law then reads silence as consent. Measured on
    // `demos/ask-quorum` — with one responder down, the room it would have refused was
    // booked.
    await expect(ask(app)({ room: 'atrium' }))
      .rejects.toThrow(/1 of 2 responder\(s\) did not answer.*check/s);
  });

  it('answers nothing when nobody responds, rather than pretending', async () => {
    await using app = await asking();

    // Legal — asking nobody is not an error. What it is NOT is agreement, and an empty
    // list says so where a law like `every(ok)` would have said yes.
    expect(await ask(app)({ room: 'library' })).toEqual([]);
  });

  it('refuses to ask a subject a carrier also publishes', async () => {
    // A carrier reaches whoever subscribed elsewhere and brings nothing back, so the
    // answer would hold only this process's responders — and say nothing about it.
    await expect(createApp({
      fronds: [frond('booking', { entities: [CanBook] }), frond('r', { handlers: [answering(Rooms)] })],
      createContainer,
      onEmit: async () => {},
    })).rejects.toThrow(/'canBook' is asked, and this app has a carrier/);
  });
});
