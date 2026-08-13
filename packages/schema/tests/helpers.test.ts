import { describe, it, expect } from 'vitest';
import {
  entity, primary, text, number, bool, date, created, updated, immutable, oneOf, ref, many, optional, json, list, email, url, isField, isNullable,
} from '../src/index.js';

describe('helpers', () => {
  it('primary() creates an auto-generated id field (cuid2 default)', () => {
    const f = primary();
    expect(isField(f)).toBe(true);
    expect(f.shape).toEqual({ type: 'string' });
    expect(f.role?.primary).toBe(true);
    // identity in the graph implies immutability in time (default 2026-07-15)
    expect(f.lifecycle).toEqual({ create: { generate: 'cuid2' }, update: 'forbidden' });
  });

  it('primary({ generate: "uuid" }) uses UUID generator', () => {
    const f = primary({ generate: 'uuid' });
    expect(f.role?.primary).toBe(true);
    expect(f.lifecycle?.create).toEqual({ generate: 'uuid' });
  });

  it('primary(field) promotes an existing field to primary key', () => {
    const f = primary(text());
    expect(f.shape?.type).toBe('string');
    expect(f.role?.primary).toBe(true);
    expect(f.lifecycle?.create).toBeUndefined();
    expect(f.lifecycle?.update).toBe('forbidden'); // promotion carries immutability
  });

  it('primary(number()) promotes a number field to primary key', () => {
    const f = primary(number({ integer: true }));
    expect(f.shape).toEqual({ type: 'integer' });
    expect(f.role?.primary).toBe(true);
  });

  it('text() creates a string field with constraints', () => {
    const f = text({ min: 1, max: 255, pattern: '^[a-z]+$' });
    expect(f.shape).toEqual({ type: 'string', minLength: 1, maxLength: 255, pattern: '^[a-z]+$' });
  });

  it('text() creates a string field without options', () => {
    const f = text();
    expect(f.shape?.type).toBe('string');
    expect(isNullable(f.shape)).toBe(false);
  });

  it('number() creates a number field with constraints', () => {
    const f = number({ min: 0, max: 100, integer: true, description: 'Percentage' });
    expect(f.shape).toEqual({ type: 'integer', minimum: 0, maximum: 100 });
    expect(f.meta).toEqual({ description: 'Percentage' });
  });

  it('bool() creates a boolean field', () => {
    const f = bool({ default: false });
    expect(f.shape?.type).toBe('boolean');
    expect(f.lifecycle?.create).toEqual({ value: false });
  });

  it('date() creates a date field', () => {
    const f = date();
    expect(f.shape).toEqual({ type: 'string', format: 'date-time' });
  });

  it('created() creates a date field stamped at creation, immutable after', () => {
    const f = created();
    expect(f.shape).toEqual({ type: 'string', format: 'date-time' });
    expect(f.lifecycle).toEqual({ create: 'now', update: 'forbidden' });
  });

  it('updated() creates a date field stamped at creation and at every update', () => {
    const f = updated();
    expect(f.shape).toEqual({ type: 'string', format: 'date-time' });
    expect(f.lifecycle).toEqual({ create: 'now', update: 'now' });
  });

  it('immutable() forbids re-writing, the other axes and create rule are untouched', () => {
    const f = immutable(text({ min: 1 }));
    expect(f.lifecycle?.update).toBe('forbidden');
    expect(f.shape?.type).toBe('string');
    const id = immutable(primary());
    expect(id.lifecycle).toEqual({ create: { generate: 'cuid2' }, update: 'forbidden' });
  });

  it('oneOf() creates a string field constrained to an enum', () => {
    const f = oneOf('pending', 'paid', 'shipped');
    expect(f.shape).toEqual({ type: 'string', enum: ['pending', 'paid', 'shipped'] });
  });

  it('ref() creates a one-relation field', () => {
    class Customer extends entity({ id: primary() }) {}
    const f = ref(Customer);
    expect(f.shape?.type).toBe('string');
    expect(f.role?.relation?.kind).toBe('one');
    expect(f.role?.relation?.to()).toBe(Customer);
  });

  it('many() is an array whose elements live on the other side', () => {
    class OrderLine extends entity({ id: primary() }) {}
    const f = many(OrderLine);
    // The value IS a collection — the field says that much itself. What it does NOT say
    // is the element shape (no `items`): that belongs to the target, and the role names it.
    expect(f.shape).toEqual({ type: 'array' });
    expect(f.role?.relation?.kind).toBe('many');
    expect(f.role?.relation?.to()).toBe(OrderLine);
  });

  it('optional() puts null in the grammar and permits absence', () => {
    const f = optional(text());
    expect(f.shape?.type).toEqual(['string', 'null']);
    expect(isNullable(f.shape)).toBe(true);
    expect(f.lifecycle?.create).toBe('optional');
  });

  it('json() creates an opaque json field — any value passes', () => {
    const f = json();
    expect(f.shape).toEqual({ type: 'object' });
    class Holder extends entity({ id: primary(), data: json() }) {}
    expect(Holder.validate({ data: { anything: [1, 'x'] } }).success).toBe(true);
  });

  it('list() embeds the element shape — every element is validated by the engine', () => {
    class Post extends entity({ id: primary(), tags: list(text({ min: 1 }), { max: 3 }) }) {}
    const f = Post.getFields().tags;
    expect(f.shape).toEqual({ type: 'array', items: { type: 'string', minLength: 1 }, maxItems: 3 });

    expect(Post.validate({ tags: ['a', 'b'] }).success).toBe(true);
    expect(Post.validate({ tags: [] }).success).toBe(true);
    expect(Post.validate({ tags: ['a', ''] }).success).toBe(false);          // element violates minLength
    expect(Post.validate({ tags: ['a', 'b', 'c', 'd'] }).success).toBe(false); // maxItems
    expect(Post.validate({ tags: 'a' }).success).toBe(false);                // not an array
  });

  it('list() rejects a relation field — a list is a value, not a relation', () => {
    class Other extends entity({ id: primary() }) {}
    expect(() => list(many(Other) as never)).toThrow(/value field/);
  });

  it('format predicates (email, uuid, uri) are asserted by the engine', () => {
    class Account extends entity({
      id: primary(),
      mail: email(),
      site: optional(url()),
      token: text({ format: 'uuid' }),
    }) {}
    expect(Account.validate({ mail: 'a@b.co', token: '123e4567-e89b-12d3-a456-426614174000' }).success).toBe(true);
    expect(Account.validate({ mail: 'not-an-email', token: '123e4567-e89b-12d3-a456-426614174000' }).success).toBe(false);
    expect(Account.validate({ mail: 'a@b.co', token: 'nope' }).success).toBe(false);
    expect(Account.validate({ mail: 'a@b.co', token: '123e4567-e89b-12d3-a456-426614174000', site: ':not a url' }).success).toBe(false);
    expect(Account.validate({ mail: 'a@b.co', token: '123e4567-e89b-12d3-a456-426614174000', site: 'https://x.dev' }).success).toBe(true);
  });

  it('json(Entity) embeds the entity shape — nested structure is validated', () => {
    class Address extends entity({ street: text({ min: 1 }), zip: text(), country: optional(text()) }) {}
    class Customer extends entity({ id: primary(), address: json(Address) }) {}

    const f = Customer.getFields().address;
    expect(f.shape?.type).toBe('object');
    expect((f.shape as { required?: string[] }).required).toEqual(['street', 'zip']);
    // shape-only embed: nested role/lifecycle/boundary are stripped
    expect(JSON.stringify(f.shape)).not.toContain('x-fougere');

    expect(Customer.validate({ address: { street: '1 rue X', zip: '75001' } }).success).toBe(true);
    const bad = Customer.validate({ address: { street: '', zip: '75001' } }); // minLength violated, nested
    expect(bad.success).toBe(false);
    const missing = Customer.validate({ address: { street: '1 rue X' } }); // zip required, nested
    expect(missing.success).toBe(false);
  });
});
