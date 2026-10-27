/**
 * A parameter with no `?` that nothing filled is refused before the handler runs — the request's
 * own parts with `Required`, a collected one in its collector's words. Its absence is the caller's
 * to fix, and a handler used to check it by hand: `if (!user) throw …` in every op that wanted one.
 */
import { describe, it, expect } from 'vitest';
import { createContainer } from '@fougere/container';
import { bool, entity, json, optional, primary, text } from '@fougere/schema';
import { Collect, createApp, createLocalRunner, ErrorCode, FougereError, frond, type InvocationContext } from '../src/index.js';
import { Invocation } from '../src/wire/Invocation.js';
import { collected, input, op } from './contract.js';

class Visitor extends entity({ id: primary(text()), name: text() }) {}
class Note extends entity({ title: text() }) {}

class VisitorCollector extends Collect<Visitor> {
  async collect(ctx: InvocationContext) { return ctx.state.visitor as Visitor | undefined; }
  missing(ctx: InvocationContext): never {
    throw new FougereError({
      code: ErrorCode.UNAUTHORIZED,
      message: ctx.state.expired ? 'Your session expired.' : 'Sign in first.',
    });
  }
}

class Guest extends entity({ id: primary(text()) }) {}
class GuestCollector extends Collect<Guest> {
  async collect() { return undefined; }
}

class DeskHandler {
  async mine(visitor: Visitor) { return visitor.name; }
  async maybe(visitor?: Visitor) { return visitor?.name ?? null; }
  async guest(guest: Guest) { return guest.id; }
  async write(note: Note) { return note.title; }
}

const desk = frond('desk', {
  entities: [Visitor, Note, Guest],
  collectors: [{ ctor: VisitorCollector, collects: Visitor }, { ctor: GuestCollector, collects: Guest }],
  handlers: [{
    ctor: DeskHandler,
    operations: {
      mine: op({ args: [collected('visitor', 'visitor')], cardinality: 'one' }),
      maybe: op({ args: [collected('visitor', 'visitor', { optional: true })], cardinality: 'maybe' }),
      guest: op({ args: [collected('guest', 'guest')], cardinality: 'one' }),
      write: op({ args: [input('note')], input: Note, cardinality: 'one' }),
    },
  }],
});

async function call(op: string, state: Record<string, unknown> = {}, given?: unknown): Promise<unknown> {
  await using app = await createApp({
    fronds: [desk],
    createContainer,
    extensions: [{ name: 'visitors', state: { visitor: optional(json(Visitor)), expired: optional(bool()) } }],
  });

  try {
    return await createLocalRunner(app)({ address: 'desk', op }, { ...Invocation.empty, state, input: given });
  } catch (refusal) {
    return refusal;
  }
}

describe('a required parameter nothing filled', () => {
  it('is refused in its collector\'s words, which may tell one absence from another', async () => {
    expect(await call('mine')).toMatchObject({ code: ErrorCode.UNAUTHORIZED, message: 'Sign in first.' });
    expect(await call('mine', { expired: true })).toMatchObject({ code: ErrorCode.UNAUTHORIZED, message: 'Your session expired.' });
  });

  it('is filled when its source has a value, and left out when the parameter says it may be', async () => {
    expect(await call('mine', { visitor: { id: 'v1', name: 'Ada' } })).toBe('Ada');
    expect(await call('maybe')).toBeNull();
  });

  it('is refused with Required when its source has no words for the absence', async () => {
    expect(await call('guest')).toMatchObject({ code: ErrorCode.VALIDATION_FAILED, message: 'guest: Required' });
  });

  it('is refused for an input view nothing was sent for, rather than handed undefined', async () => {
    expect(await call('write')).toMatchObject({ code: ErrorCode.VALIDATION_FAILED, message: 'note: Required' });
    expect(await call('write', {}, { title: 'Ferns' })).toBe('Ferns');
  });
});
