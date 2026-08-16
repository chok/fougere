import { Anatomy, Judge, FieldGroup, Unique } from '../src/index.js';
import { describe, it, expect } from 'vitest';
import {
  entity, primary, text, number, oneOf, list, optional, nullable,
  registerGenerator, resolveCustomGenerator, unique, indexed, describe as describeSchema, reconstruct,
} from '../src/index.js';

// ─── nullableShape / anatomy — the two gates of the union, per shape genre ──

describe('nullableShape — null enters the grammar', () => {
  it('scalar: the type becomes the [T, null] union', () => {
    expect(Anatomy.nullable({ type: 'string' }).type).toEqual(['string', 'null']);
    expect(Anatomy.nullable({ type: 'integer' }).type).toEqual(['integer', 'null']);
    expect(Anatomy.nullable({ type: 'boolean' }).type).toEqual(['boolean', 'null']);
  });

  it('enum: null joins the closed value set too', () => {
    const s = Anatomy.nullable({ type: 'string', enum: ['a', 'b'] });
    expect(s.type).toEqual(['string', 'null']);
    expect((s as { enum?: readonly (string | null)[] }).enum).toEqual(['a', 'b', null]);
  });

  it('array/object: the union wraps the container, items/properties untouched', () => {
    const arr = Anatomy.nullable({ type: 'array', items: { type: 'string' } });
    expect(arr.type).toEqual(['array', 'null']);
    expect((arr as { items: object }).items).toEqual({ type: 'string' });
  });

  it('is idempotent', () => {
    const once = Anatomy.nullable({ type: 'string', enum: ['a'] });
    const twice = Anatomy.nullable(once);
    expect(twice).toBe(once);
  });

  it('keeps constraints on the base type', () => {
    expect(Anatomy.nullable({ type: 'string', minLength: 3 })).toEqual({ type: ['string', 'null'], minLength: 3 });
  });
});

describe('anatomy — the single customs post for readers', () => {
  it('splits the union back into base + nullable', () => {
    const { base, nullable } = Anatomy.of({ type: ['integer', 'null'], minimum: 0 } as never);
    expect(nullable).toBe(true);
    expect(base).toEqual({ type: 'integer', minimum: 0 });
  });

  it('a scalar shape is its own base, not nullable', () => {
    const shape = { type: 'string' as const };
    const { base, nullable } = Anatomy.of(shape);
    expect(nullable).toBe(false);
    expect(base).toBe(shape);
  });

  it('strips null from enum in the base', () => {
    const { base } = Anatomy.of(Anatomy.nullable({ type: 'string', enum: ['a', 'b'] }));
    expect((base as { enum?: readonly (string | null)[] }).enum).toEqual(['a', 'b']);
  });

  it('no shape → no base, not nullable (a many relation)', () => {
    expect(Anatomy.of(undefined)).toEqual({ base: undefined, nullable: false });
  });

  it('isNullable is the sugar for the flag', () => {
    expect(Anatomy.isNullable(Anatomy.nullable({ type: 'string' }))).toBe(true);
    expect(Anatomy.isNullable({ type: 'string' })).toBe(false);
    expect(Anatomy.isNullable(undefined)).toBe(false);
  });
});

// ─── The quadrant — presence × nullity, independently composable ──

describe('quadrant présence × nullité', () => {
  it('nullable(): null legal, field still REQUIRED (the new quadrant)', () => {
    const fields = { note: nullable(text()) };
    expect(Judge.row(fields, {}).success).toBe(false); // absent → Required
    expect(Judge.row(fields, { note: null }).success).toBe(true); // explicit null legal
    expect(Judge.row(fields, { note: 'x' }).success).toBe(true);
  });

  it('optional(): null legal AND absence permitted', () => {
    const fields = { note: optional(text()) };
    const absent = Judge.row(fields, {});
    expect(absent.success).toBe(true);
    if (absent.success) expect('note' in absent.data).toBe(false); // omitted, not nulled
    expect(Judge.row(fields, { note: null }).success).toBe(true);
  });

  it('bare field: null illegal, absence illegal', () => {
    const fields = { note: text() };
    expect(Judge.row(fields, {}).success).toBe(false);
    expect(Judge.row(fields, { note: null }).success).toBe(false);
  });

  it('nullable(oneOf(...)): null joins the enum, other values stay constrained', () => {
    const fields = { status: nullable(oneOf('pending', 'paid')) };
    expect(Judge.row(fields, { status: null }).success).toBe(true);
    expect(Judge.row(fields, { status: 'paid' }).success).toBe(true);
    expect(Judge.row(fields, { status: 'nope' }).success).toBe(false);
  });

  it('nullable(number(...)): constraints apply to the base type only, null passes', () => {
    const fields = { n: nullable(number({ min: 0, integer: true })) };
    expect(Judge.row(fields, { n: null }).success).toBe(true);
    expect(Judge.row(fields, { n: 3 }).success).toBe(true);
    expect(Judge.row(fields, { n: -1 }).success).toBe(false);
    expect(Judge.row(fields, { n: 1.5 }).success).toBe(false);
  });

  it('nullable elements inside a list validate natively', () => {
    const fields = { tags: list(nullable(text({ min: 1 }))) };
    expect(Judge.row(fields, { tags: ['a', null] }).success).toBe(true);
    expect(Judge.row(fields, { tags: [''] }).success).toBe(false);
  });
});

// ─── Generator registry — named tokens, loud failure ──

describe('registerGenerator — custom generators travel by name', () => {
  it('a registered name resolves to its function', () => {
    registerGenerator('monId', () => 'fixed-id');
    expect(resolveCustomGenerator('monId')?.()).toBe('fixed-id');
  });

  it('an unknown name resolves to undefined (the storage adapter turns this into a loud error)', () => {
    expect(resolveCustomGenerator('jamais-vu')).toBeUndefined();
  });

  it('primary({ generate: [name, fn] }) registers and names in one gesture', () => {
    const f = primary({ generate: ['tupleId', () => 'from-tuple'] });
    expect(f.lifecycle?.create).toEqual({ generate: 'tupleId' });
    expect(resolveCustomGenerator('tupleId')?.()).toBe('from-tuple');
  });
});

// ─── Wire — the union IS the wire form, extension carries the normal forms ──

describe('descriptor carries the axes verbatim', () => {
  it('nullable() folds into the type union on the wire, and required keeps the field', async () => {
    const { describe: describeCard } = await import('../src/index.js');
    class Memo extends entity({ id: primary(), note: nullable(text()) }) {}
    const card = describeCard(Memo, 'memo');
    expect(card.properties.note.type).toEqual(['string', 'null']);
    expect(card.required).toContain('note'); // nullable-but-required survives the wire
  });
});

// ─── role.unique / role.index — the axis members storage realizes ──

describe('unique / indexed — declared here, enforced by the storage', () => {
  class Account extends entity({
    id: primary(),
    email: unique(text()),
    city: indexed(optional(text())),
    bio: optional(text()),
  }) {}

  const fields = Account.getFields();

  it('sets the role flag and leaves every other axis alone', () => {
    // `entity()` names the carrier, so a group of one arrives already resolved — the live
    // schema and a reconstructed one now answer the same thing.
    expect(FieldGroup.on(fields.email!, Unique).map((g) => g.members)).toEqual([['email']]);
    expect(fields.city.role?.index).toBe(true);
    // The wrapper composes: `indexed(optional(...))` keeps the optionality.
    expect(fields.city.lifecycle?.create).toBe('optional');
    expect(fields.bio.role?.rules).toBeUndefined();
  });

  /**
   * The shape is untouched, and that is the point: uniqueness is not a property of a
   * value. Judging one input can never see the other rows, so `validate` must stay
   * silent about it — a collision is the database's answer, not the judge's.
   */
  it('does not make the judge refuse a duplicate — it cannot see the other rows', () => {
    expect(Account.validate({ id: 'a', email: 'x@y.z' }).success).toBe(true);
    expect(Account.validate({ id: 'b', email: 'x@y.z' }).success).toBe(true);
  });

  it('travels on the card, both ways', () => {
    const card = describeSchema(Account, 'account');
    // Members are NAMED on the wire: a consumer reads the constraint without having to
    // know which property the group hangs on.
    expect(card.properties.email['x-fougere']).toMatchObject({ role: { unique: [['email']] } });
    expect(card.properties.city['x-fougere']).toMatchObject({ role: { index: true } });

    const rebuilt = reconstruct(card);
    expect(FieldGroup.on(rebuilt.getFields().email!, Unique).map((g) => g.members)).toEqual([['email']]);
    expect(rebuilt.getFields().city.role?.index).toBe(true);
    // A constraint of one is not a composite — it is fully stated by the field itself.
    expect(rebuilt.getUnique()).toBeUndefined();
  });
});
