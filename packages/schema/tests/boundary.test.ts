import { Boundaries } from '../src/axis/boundary/Boundaries.js';
import { Boundary } from '../src/axis/boundary/Boundary.js';
import { RowJudge } from '../src/judge/RowJudge.js';
import { describe, it, expect } from 'vitest';
import { entity } from '../src/entity.js';
import { primary } from '../src/vocabulary/primary.js';
import { text } from '../src/vocabulary/text.js';
import { date } from '../src/vocabulary/date.js';
import { optional } from '../src/vocabulary/optional.js';
import { readOnly } from '../src/vocabulary/readOnly.js';
import { writeOnly } from '../src/vocabulary/writeOnly.js';
import { Visibility } from '../src/projection/Visibility.js';
import { Field } from '../src/fields/Field.js';

class Event extends entity({
  id: primary(),
  name: text({ min: 1 }),
  startsAt: date(),
}) {}

describe('boundary · date default (derived from shape)', () => {
  it('validate() decodes an ISO string into a Date', () => {
    const result = Event.validate({ id: 'e1', name: 'Launch', startsAt: '2026-05-31T10:00:00.000Z' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.startsAt).toBeInstanceOf(Date);
  });

  it('from() decodes too — the returned value matches its declared Date type (#3)', () => {
    const out = Event.from({ id: 'e1', name: 'Launch', startsAt: '2026-05-31T10:00:00.000Z' });
    expect(out.startsAt).toBeInstanceOf(Date);
  });

  it('encode (egress) turns a Date back into an ISO string', () => {
    const field = Event.getFields().startsAt;
    const wire = Boundary.of(field).encode(new Date('2026-05-31T10:00:00.000Z'));
    expect(wire).toBe('2026-05-31T10:00:00.000Z');
  });

  it('the derived default survives the nullable union — optional(date()) still decodes', () => {
    class Task extends entity({ id: primary(), dueAt: optional(date()) }) {}
    const result = Task.validate({ id: 't1', dueAt: '2026-05-31T10:00:00.000Z' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.dueAt).toBeInstanceOf(Date);
    // and a legal null skips decode instead of being rejected by the decoder
    const asNull = Task.validate({ id: 't1', dueAt: null });
    expect(asNull.success).toBe(true);
    if (asNull.success) expect(asNull.data.dueAt).toBeNull();
  });
});

describe('boundary · non-date kinds are identity', () => {
  it('a string field decodes to itself', () => {
    const field = Event.getFields().name;
    expect(Boundary.of(field).decode('hi')).toEqual({ value: 'hi' });
  });
});

describe('boundary · override slot', () => {
  it('a registered alias overrides the shape-derived default', () => {
    Boundaries.registerDecoder('fromCents', (v) => ({ value: typeof v === 'number' ? v / 100 : v }));
    Boundaries.registerEncoder('toCents', (v) => (typeof v === 'number' ? Math.round(v * 100) : v));
    Boundaries.registerAlias('moneyCents', { in: { decode: 'fromCents' }, out: { encode: 'toCents' } });

    const price = new Field<number>({ shape: { type: 'number' }, boundary: 'moneyCents' });
    const { decode, encode } = Boundary.of(price);
    expect(decode(1099)).toEqual({ value: 10.99 });
    expect(encode(10.99)).toBe(1099);
  });

  it('directional form allows asymmetry — an absent direction is identity', () => {
    const f = new Field<number>({ shape: { type: 'number' }, boundary: { in: { decode: 'fromCents' } } });
    expect(Boundary.of(f).decode(500)).toEqual({ value: 5 });
    expect(Boundary.of(f).encode(5)).toBe(5); // no out rule → identity
  });

  it('an unknown alias throws at resolve time', () => {
    const f = new Field<number>({ shape: { type: 'number' }, boundary: 'nope' });
    expect(() => Boundary.of(f)).toThrow(/Unknown boundary alias/);
  });

  // The two spellings of one axis must fail the same way. The direct form used to
  // fall back to identity: the value arrived unconverted while the card said it had
  // been converted, and nothing said a word.
  it('an unregistered NAMED codec throws too, in both directions', () => {
    const inbound = new Field<number>({ shape: { type: 'number' }, boundary: { in: { decode: 'celsius' } } });
    expect(() => Boundary.of(inbound)).toThrow(/Unknown boundary decoder: 'celsius'/);

    const outbound = new Field<number>({ shape: { type: 'number' }, boundary: { out: { encode: 'celsius' } } });
    expect(() => Boundary.of(outbound)).toThrow(/Unknown boundary encoder: 'celsius'/);
  });
});

describe("boundary · 'closed' permissions (readOnly / writeOnly)", () => {
  it("readOnly() closes in — present in an input is 'Read-only', absent is never 'Required'", () => {
    const fields = { views: readOnly(text()), title: text() };
    const present = RowJudge.of(fields).check({ views: '9', title: 'x' });
    expect(present.success).toBe(false);
    if (!present.success) expect(present.errors[0]).toEqual({ path: 'views', message: 'Read-only' });
    // absent: the server owns it — no Required error despite no create rule
    expect(RowJudge.of(fields).check({ title: 'x' }).success).toBe(true);
    // rejected in patch mode too
    expect(RowJudge.of(fields, { patch: true }).check({ views: '9' }).success).toBe(false);
  });

  it('writeOnly() closes out — accepted at ingress, omitted at egress', () => {
    const fields = { password: writeOnly(text({ min: 8 })), name: text() };
    const v = RowJudge.of(fields).check({ password: 'hunter22', name: 'Ada' });
    expect(v.success).toBe(true);
    if (v.success) expect(v.data.password).toBe('hunter22'); // ingress open, shape judged
    const wire = Visibility.of(fields).encode({ password: 'hunter22', name: 'Ada' });
    expect('password' in wire).toBe(false);
    expect(wire.name).toBe('Ada');
  });

  it('closing one direction keeps the derived conversion of the other (writeOnly date)', () => {
    const f = writeOnly(date());
    expect(Boundary.of(f).out).toBe('closed');
    expect(Boundary.of(f).decode('2026-05-31T10:00:00.000Z')).toEqual({ value: new Date('2026-05-31T10:00:00.000Z') });
  });
});

describe('boundary · survives every field transform', () => {
  Boundaries.registerDecoder('fromCents', (v) => ({ value: typeof v === 'number' ? v / 100 : v }));
  Boundaries.registerEncoder('toCents', (v) => (typeof v === 'number' ? Math.round(v * 100) : v));
  Boundaries.registerAlias('moneyCents', { in: { decode: 'fromCents' }, out: { encode: 'toCents' } });
  const money = () => new Field<number>({ shape: { type: 'number' }, boundary: 'moneyCents' });

  it('optional() keeps the boundary', () => {
    expect(Boundary.of(optional(money())).decode(1099)).toEqual({ value: 10.99 });
  });

  it('primary(field) keeps the boundary AND the description', () => {
    const f = primary(new Field<string>({ shape: { type: 'string' }, boundary: 'moneyCents', meta: { description: 'id' } }));
    expect(Boundary.of(f).decode(1099)).toEqual({ value: 10.99 });
    expect(f.meta?.description).toBe('id');
  });

  it('partial() keeps the boundary', () => {
    class M extends entity({ price: money() }) {}
    expect(Boundary.of(M.partial().getFields().price).decode(1099)).toEqual({ value: 10.99 });
  });
});
