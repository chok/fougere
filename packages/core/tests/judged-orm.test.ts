/**
 * A handler writing through the ORM cannot store a value the shape refuses.
 *
 * Measured 2026-07-25, before this: `status: 'n-importe-quoi'` on a
 * `oneOf('draft','published')` was stored and read back unchanged. The database catches
 * nullability and column types, never a closed set or a format.
 */
import { describe, it, expect, vi } from 'vitest';
import { entity, primary, text, oneOf, email, number, optional, readOnly } from '@fougere/schema';
import { judgeOnWrite } from '../src/judged-orm.js';
import { FougereError, ErrorCode } from '../src/middleware.js';

class Contact extends entity({
  id: primary(),
  name: text({ min: 1 }),
  status: oneOf('draft', 'published'),
  reachAt: optional(email()),
  score: optional(number()),
  ownerId: readOnly(text()),
}) {}

function spyOrm() {
  const orm = {
    create: vi.fn(async (input: Record<string, unknown>) => input),
    update: vi.fn(async (_id: unknown, input: Record<string, unknown>) => input),
    findById: vi.fn(async () => ({ id: 'c1' })),
    output: vi.fn(function (this: unknown) { return Object.create(this as object); }),
  };
  return orm;
}

const judged = () => {
  const orm = spyOrm();
  return { orm, guarded: judgeOnWrite(orm, Contact as never, 'contact') };
};

const ok = { id: 'c1', name: 'Ada', status: 'draft', ownerId: 'u1' };

describe('what the shape refuses never reaches storage', () => {
  it('refuses a value outside a closed set', async () => {
    const { orm, guarded } = judged();

    await expect(guarded.create({ ...ok, status: 'n-importe-quoi' })).rejects.toThrow(FougereError);
    expect(orm.create).not.toHaveBeenCalled();
  });

  it('refuses a malformed email and a non-number', async () => {
    const { guarded } = judged();

    await expect(guarded.create({ ...ok, reachAt: 'pas-un-email' })).rejects.toThrow(/reachAt/);
    await expect(guarded.create({ ...ok, score: 'texte' })).rejects.toThrow(/score/);
  });

  it('is our bug, not the caller’s — so it is an internal error', async () => {
    const { guarded } = judged();

    await guarded.create({ ...ok, status: 'nope' }).catch((e: FougereError) => {
      expect(e.code).toBe(ErrorCode.INTERNAL_ERROR);
      expect(e.entity).toBe('contact');
      expect(e.operation).toBe('create');
    });
    expect.assertions(3);
  });

  it('lets a legal write through untouched', async () => {
    const { orm, guarded } = judged();

    await guarded.create(ok);
    expect(orm.create).toHaveBeenCalledWith(ok);
  });
});

describe('what this judge must NOT do', () => {
  it('never reads the client-only axes — a read-only field is legal here', async () => {
    const { orm, guarded } = judged();

    // The façade refuses `ownerId` from a client. The domain writes it freely.
    await guarded.create(ok);
    expect(orm.create).toHaveBeenCalled();
  });

  it('says nothing about the fields a patch does not mention', async () => {
    const { orm, guarded } = judged();

    await guarded.update('c1', { status: 'published' });
    expect(orm.update).toHaveBeenCalledWith('c1', { status: 'published' });
  });

  it('still refuses a bad value inside a patch', async () => {
    const { orm, guarded } = judged();

    await expect(guarded.update('c1', { status: 'nope' })).rejects.toThrow(FougereError);
    expect(orm.update).not.toHaveBeenCalled();
  });
});

describe('the wrapper leaves the rest of the ORM alone', () => {
  it('keeps reads reachable', async () => {
    const { guarded } = judged();
    expect(await (guarded as never as { findById(): Promise<unknown> }).findById()).toEqual({ id: 'c1' });
  });

  it('a copy scoped afterwards still judges', async () => {
    const { guarded } = judged();
    const scoped = (guarded as never as { output(): typeof guarded }).output();

    await expect(scoped.create({ ...ok, status: 'nope' })).rejects.toThrow(FougereError);
  });
});
