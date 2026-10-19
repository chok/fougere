/**
 * The one cycle every door runs, whichever package brought it: core names no door. A request is
 * not a call — one document may make several — so each call says which request it answers.
 */
import { describe, it, expect } from 'vitest';
import { createContainer } from '@fougere/container';
import { createApp, DispatchEvent, DoorEvent, DoorMiddleware, ErrorCode, FougereError, frond, type Door, type DoorOutcome } from '../src/index.js';
import { op } from './contract.js';

class OrderHandler {
  async list() { return ['a', 'b']; }
  async count() { return 2; }
  async boom(): Promise<never> { throw new Error('secret at /etc/db.sqlite'); }
  async locked(): Promise<never> { throw new FougereError({ code: ErrorCode.FORBIDDEN, message: 'Not yours.' }); }
}

const shop = frond('shop', {
  handlers: [{
    ctor: OrderHandler,
    deps: [],
    operations: {
      list: op({ cardinality: 'many' }), count: op({ cardinality: 'none' }),
      boom: op({ cardinality: 'none' }), locked: op({ cardinality: 'none' }),
    },
  }],
});

/** A door of no real kind: it receives op names, calls each, and answers what came back. */
function lineDoor(app: Awaited<ReturnType<typeof createApp>>, refuseOn?: string): Door<string, string[], DoorOutcome> {
  return {
    name: 'line',
    decode: async (received) => {
      if (received === refuseOn) throw new FougereError({ code: ErrorCode.BAD_REQUEST, message: 'Unreadable line.' });

      return received.split(' ');
    },
    run: async (ops) => {
      const facade = app.facadeFor('order')!;

      return Promise.all(ops.map((name) => facade[name]!({})));
    },
    encode: (outcome) => outcome,
  };
}

describe('a door', () => {
  it('runs every call a request makes within that request, and says so', async () => {
    await using app = await createApp({ fronds: [shop], createContainer });
    const seen: (DispatchEvent | DoorEvent)[] = [];
    app.observe((event) => seen.push(event));

    expect(await app.answer(lineDoor(app), 'list count')).toEqual({ answered: [['a', 'b'], 2] });
    await app.answer(lineDoor(app), 'list');

    const requests = seen.filter((event) => event instanceof DoorEvent && event.stage === 'received').map((event) => (event as DoorEvent).request);
    const calls = seen.filter((event): event is DispatchEvent => event instanceof DispatchEvent && event.stage === 'received');
    expect(requests).toHaveLength(2);
    expect(calls.map((call) => call.request)).toEqual([requests[0], requests[0], requests[1]]);
    expect(requests[0]!.door).toBe('line');
    expect(requests[0]!.id).not.toBe(requests[1]!.id);
  });

  it('announces its steps around the calls, in order', async () => {
    await using app = await createApp({ fronds: [shop], createContainer });
    const steps: string[] = [];
    app.observe((event) => steps.push(event instanceof DoorEvent ? `door:${event.stage}` : `call:${event.stage}`));

    await app.answer(lineDoor(app), 'count');

    expect(steps).toEqual([
      'door:received', 'door:decoded',
      'call:received', 'call:resolved', 'call:completed', 'call:settled',
      'door:encoded',
    ]);
  });

  it('hands the door a refusal in the words its caller may read', async () => {
    await using app = await createApp({ fronds: [shop], createContainer });

    const locked = await app.answer(lineDoor(app), 'locked') as { refused: FougereError };
    const boom = await app.answer(lineDoor(app), 'boom') as { refused: FougereError };

    expect([locked.refused.code, locked.refused.message]).toEqual([ErrorCode.FORBIDDEN, 'Not yours.']);
    expect([boom.refused.code, boom.refused.message]).toEqual([ErrorCode.INTERNAL_ERROR, 'Internal error']);
  });

  it('hands a trusted door the accident whole — its caller is the operator', async () => {
    await using app = await createApp({ fronds: [shop], createContainer });

    const boom = await app.answer({ ...lineDoor(app), trusted: true }, 'boom') as { refused: FougereError };

    expect([boom.refused.code, boom.refused.message]).toEqual([ErrorCode.INTERNAL_ERROR, 'secret at /etc/db.sqlite']);
  });

  it('refuses a request it cannot decode before any call, and still answers it', async () => {
    await using app = await createApp({ fronds: [shop], createContainer });
    const seen: string[] = [];
    app.observe((event) => seen.push(event instanceof DoorEvent ? `door:${event.stage}` : `call:${event.stage}`));

    const answer = await app.answer(lineDoor(app, 'garbled'), 'garbled') as { refused: FougereError };

    expect(answer.refused.code).toBe(ErrorCode.BAD_REQUEST);
    expect(seen).toEqual(['door:received', 'door:failed', 'door:encoded']);
  });

  it('leaves a call no door received without a request', async () => {
    await using app = await createApp({ fronds: [shop], createContainer });
    const calls: DispatchEvent[] = [];
    app.observe((event) => { if (event instanceof DispatchEvent) calls.push(event); });

    await app.facadeFor('order')!.count!({});

    expect(calls.every((call) => call.request === undefined)).toBe(true);
  });
});

/** What a door package hands out: the base, with the door it stands at. */
abstract class LineMiddleware extends DoorMiddleware<string, DoorOutcome> {
  static override readonly door = 'line';
}

const heard: string[] = [];

class Outer extends LineMiddleware {
  async around(received: string, next: () => Promise<DoorOutcome>): Promise<DoorOutcome> {
    heard.push(`outer:${received}`);

    return next();
  }
}

class Gate extends LineMiddleware {
  async around(received: string, next: () => Promise<DoorOutcome>): Promise<DoorOutcome> {
    heard.push(`gate:${received}`);
    if (received === 'forbidden') throw new FougereError({ code: ErrorCode.FORBIDDEN, message: 'Not at this door.' });
    const answer = await next();

    return 'answered' in answer ? { answered: { wrapped: answer.answered } } : answer;
  }
}

abstract class OtherMiddleware extends DoorMiddleware<string, DoorOutcome> {
  static override readonly door = 'other';
}

class Elsewhere extends OtherMiddleware {
  async around(_received: string, next: () => Promise<DoorOutcome>): Promise<DoorOutcome> {
    heard.push('elsewhere');

    return next();
  }
}

const guarded = frond('shop', {
  handlers: [{ ctor: OrderHandler, deps: [], operations: { count: op({ cardinality: 'none' }) } }],
  middlewares: [Outer, Gate, Elsewhere],
  config: { middlewares: ['Outer', 'Gate', 'Elsewhere'] },
});

describe('a door middleware', () => {
  it('stands around a door answering for its frond\'s address, outermost first, and may rewrite the answer', async () => {
    heard.length = 0;
    await using app = await createApp({ fronds: [guarded], createContainer });

    const answer = await app.answer({ ...lineDoor(app), address: 'order' }, 'count');

    expect(answer).toEqual({ answered: { wrapped: [2] } });
    expect(heard).toEqual(['outer:count', 'gate:count']);
  });

  it('refuses before the door decodes, and the door says the refusal', async () => {
    heard.length = 0;
    await using app = await createApp({ fronds: [guarded], createContainer });
    const steps: string[] = [];
    app.observe((event) => { if (event instanceof DoorEvent) steps.push(event.stage); });

    const answer = await app.answer({ ...lineDoor(app), address: 'order' }, 'forbidden') as { refused: FougereError };

    expect([answer.refused.code, answer.refused.message]).toEqual([ErrorCode.FORBIDDEN, 'Not at this door.']);
    expect(steps).toEqual(['received', 'failed', 'encoded']);
  });

  it('stands at no door answering for several addresses, and no call is wrapped by it', async () => {
    heard.length = 0;
    await using app = await createApp({ fronds: [guarded], createContainer });

    await app.answer(lineDoor(app), 'count');
    await app.facadeFor('order')!.count!({});

    expect(heard).toEqual([]);
  });
});
