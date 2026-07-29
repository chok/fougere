import { describe, it, expect } from 'vitest';
import {
  entity, primary, text, number, oneOf, list, optional, nullable,
  nullableShape, anatomy, isNullable, registerGenerator, resolveCustomGenerator,
  validateFields,
} from '../src/index.js';

// ─── nullableShape / anatomy — the two gates of the union, per shape genre ──

describe('nullableShape — null enters the grammar', () => {
  it('scalar: the type becomes the [T, null] union', () => {
    expect(nullableShape({ type: 'string' }).type).toEqual(['string', 'null']);
    expect(nullableShape({ type: 'integer' }).type).toEqual(['integer', 'null']);
    expect(nullableShape({ type: 'boolean' }).type).toEqual(['boolean', 'null']);
  });

  it('enum: null joins the closed value set too', () => {
    const s = nullableShape({ type: 'string', enum: ['a', 'b'] });
    expect(s.type).toEqual(['string', 'null']);
    expect((s as { enum?: readonly (string | null)[] }).enum).toEqual(['a', 'b', null]);
  });

  it('array/object: the union wraps the container, items/properties untouched', () => {
    const arr = nullableShape({ type: 'array', items: { type: 'string' } });
    expect(arr.type).toEqual(['array', 'null']);
    expect((arr as { items: object }).items).toEqual({ type: 'string' });
  });

  it('is idempotent', () => {
    const once = nullableShape({ type: 'string', enum: ['a'] });
    const twice = nullableShape(once);
    expect(twice).toBe(once);
  });

  it('keeps constraints on the base type', () => {
    expect(nullableShape({ type: 'string', minLength: 3 })).toEqual({ type: ['string', 'null'], minLength: 3 });
  });
});

describe('anatomy — the single customs post for readers', () => {
  it('splits the union back into base + nullable', () => {
    const { base, nullable } = anatomy({ type: ['integer', 'null'], minimum: 0 } as never);
    expect(nullable).toBe(true);
    expect(base).toEqual({ type: 'integer', minimum: 0 });
  });

  it('a scalar shape is its own base, not nullable', () => {
    const shape = { type: 'string' as const };
    const { base, nullable } = anatomy(shape);
    expect(nullable).toBe(false);
    expect(base).toBe(shape);
  });

  it('strips null from enum in the base', () => {
    const { base } = anatomy(nullableShape({ type: 'string', enum: ['a', 'b'] }));
    expect((base as { enum?: readonly (string | null)[] }).enum).toEqual(['a', 'b']);
  });

  it('no shape → no base, not nullable (a many relation)', () => {
    expect(anatomy(undefined)).toEqual({ base: undefined, nullable: false });
  });

  it('isNullable is the sugar for the flag', () => {
    expect(isNullable(nullableShape({ type: 'string' }))).toBe(true);
    expect(isNullable({ type: 'string' })).toBe(false);
    expect(isNullable(undefined)).toBe(false);
  });
});

// ─── The quadrant — presence × nullity, independently composable ──

describe('quadrant présence × nullité', () => {
  it('nullable(): null legal, field still REQUIRED (the new quadrant)', () => {
    const fields = { note: nullable(text()) };
    expect(validateFields(fields, {}).success).toBe(false); // absent → Required
    expect(validateFields(fields, { note: null }).success).toBe(true); // explicit null legal
    expect(validateFields(fields, { note: 'x' }).success).toBe(true);
  });

  it('optional(): null legal AND absence permitted', () => {
    const fields = { note: optional(text()) };
    const absent = validateFields(fields, {});
    expect(absent.success).toBe(true);
    if (absent.success) expect('note' in absent.data).toBe(false); // omitted, not nulled
    expect(validateFields(fields, { note: null }).success).toBe(true);
  });

  it('bare field: null illegal, absence illegal', () => {
    const fields = { note: text() };
    expect(validateFields(fields, {}).success).toBe(false);
    expect(validateFields(fields, { note: null }).success).toBe(false);
  });

  it('nullable(oneOf(...)): null joins the enum, other values stay constrained', () => {
    const fields = { status: nullable(oneOf('pending', 'paid')) };
    expect(validateFields(fields, { status: null }).success).toBe(true);
    expect(validateFields(fields, { status: 'paid' }).success).toBe(true);
    expect(validateFields(fields, { status: 'nope' }).success).toBe(false);
  });

  it('nullable(number(...)): constraints apply to the base type only, null passes', () => {
    const fields = { n: nullable(number({ min: 0, integer: true })) };
    expect(validateFields(fields, { n: null }).success).toBe(true);
    expect(validateFields(fields, { n: 3 }).success).toBe(true);
    expect(validateFields(fields, { n: -1 }).success).toBe(false);
    expect(validateFields(fields, { n: 1.5 }).success).toBe(false);
  });

  it('nullable elements inside a list validate natively', () => {
    const fields = { tags: list(nullable(text({ min: 1 }))) };
    expect(validateFields(fields, { tags: ['a', null] }).success).toBe(true);
    expect(validateFields(fields, { tags: [''] }).success).toBe(false);
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
