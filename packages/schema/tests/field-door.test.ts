import { describe, expect, it } from 'vitest';
import { Field } from '../src/field/Field.js';
import { Schema } from '../src/Schema.js';
import { created } from '../src/vocabulary/created.js';
import { entity } from '../src/entity.js';
import { list } from '../src/vocabulary/list.js';
import { oneOf } from '../src/vocabulary/oneOf.js';
import { optional } from '../src/vocabulary/optional.js';
import { primary } from '../src/vocabulary/primary.js';
import { text } from '../src/vocabulary/text.js';
import { updated } from '../src/vocabulary/updated.js';
import { FieldDeclarationValidator } from '../src/validator/FieldDeclarationValidator.js';
import { Role } from '../src/axis/role/Role.js';

/**
 * The constructor is the only way to obtain a field, so it is where a field is judged —
 * and where hostile input stops. Both halves are pinned here because both were reachable:
 * `new Field({})` used to be legal from any caller without a compiler, and assigning the
 * slots wholesale used to be a one-line simplification with a prototype hole under it.
 */
describe('the field door', () => {
  it('refuses what is not a field, and names the key when it was given one', () => {
    expect(() => new Field({} as never)).toThrow(/shape: Every field states a shape/);
    expect(() => new Field({} as never, 'vide')).toThrow(/Field 'vide': shape:/);
    expect(() => entity({ id: primary(), vide: {} as never })).toThrow(/Field 'vide': shape:/);
  });

  it('judges every axis against its own vocabulary, and names the one that failed', () => {
    const shape = { type: 'string' } as const;
    const refused: readonly (readonly [object, RegExp])[] = [
      [{ shape, lifecycle: 'nawak' }, /lifecycle: Expected an object/],
      [{ shape, lifecycle: { create: 'nawak' } }, /lifecycle\.create: Expected 'now', 'optional'/],
      [{ shape, lifecycle: { update: 'nawak' } }, /lifecycle\.update: Expected 'now' or 'forbidden'/],
      [{ shape, role: 'nawak' }, /role: Expected an object/],
      [{ shape, role: { relation: { kind: 'nawak', to: () => ({}) } } }, /role\.relation\.kind/],
      [{ shape, role: { relation: { kind: 'one' } } }, /role\.relation\.to: Expected a function returning the target entity/],
      [{ shape, role: { unique: 'yes' } }, /role\.unique: Expected a boolean/],
      [{ shape, boundary: { in: { nawak: 'x' } } }, /boundary\.in/],
      [{ shape, meta: 42 }, /meta: Expected an object/],
    ];
    for (const [init, message] of refused) {
      expect(() => new Field(init as never)).toThrow(message);
    }
  });

  it('reports every fault at once, not the first', () => {
    const verdict = FieldDeclarationValidator.of({ shape: 42, lifecycle: { update: 'nawak' }, meta: 7 }).verdict;
    expect(verdict.success).toBe(false);
    if (!verdict.success) {
      expect(verdict.errors.map((e) => e.path)).toEqual(['shape', 'lifecycle.update', 'meta']);
    }
  });

  it('accepts everything the vocabulary builds', () => {
    expect(() => entity({
      id: primary(),
      title: text({ default: 'x' }),
      note: optional(text()),
      at: created(),
      seen: updated(),
      tags: list(text()),
      status: oneOf('draft', 'live', { default: 'draft' }),
    })).not.toThrow();
  });

  it('takes a plain role — the object a config or another language writes', () => {
    const f = new Field({ shape: { type: 'string' }, role: { unique: true } } as never, 'slug');
    expect(Role.of(f).isUnique).toBe(true);
  });

  it('takes a plain object — a config, plain JS, a card another language wrote', () => {
    const plain = { shape: { type: 'string', minLength: 3 } } as unknown as Field<string>;
    const Foreign = entity({ id: primary(), title: plain });
    const field = Foreign.getFields().title;
    expect(field).toBeInstanceOf(Field);
    expect(typeof field.with).toBe('function');

    const short = Foreign.validate({ id: 'x', title: 'ab' });
    expect(short.success).toBe(false);
  });

  it('keeps the five slots and nothing else', () => {
    const f = new Field({ shape: { type: 'string' }, nawak: 42 } as never);
    expect('nawak' in f).toBe(false);
  });

  it('survives a card carrying __proto__ — the input this door exists to accept', () => {
    // `Object.assign(this, init)` would copy through [[Set]], firing the `__proto__`
    // setter: the field would lose `with` and gain whatever the sender put there.
    const hostile = JSON.parse('{"shape":{"type":"string"},"__proto__":{"polluted":true}}');
    const f = new Field(hostile);

    expect(Object.getPrototypeOf(f)).toBe(Field.prototype);
    expect(typeof f.with).toBe('function');
    expect((f as unknown as { polluted?: boolean }).polluted).toBeUndefined();
    expect(({} as { polluted?: boolean }).polluted).toBeUndefined();  // nor globally
  });

  it('a field built from the vocabulary is the same thing', () => {
    expect(text()).toBeInstanceOf(Field);
    expect(text().with({ meta: { description: 'x' } }).shape).toEqual({ type: 'string' });
  });
});

describe('the schema door', () => {
  class Post extends entity({ id: primary(), title: text() }) {}

  it('survives a row carrying __proto__ — the same hole `Field` closed', () => {
    // `Object.assign(this, data)` writes through [[Set]]: a `__proto__` key from a parsed
    // JSON row fires the setter and replaces the instance's prototype.
    const hostile = JSON.parse('{"title":"x","__proto__":{"polluted":true}}');
    const post = new Post(hostile);

    expect(Object.getPrototypeOf(post)).toBe(Post.prototype);
    expect((post as unknown as { polluted?: boolean }).polluted).toBeUndefined();
    expect(({} as { polluted?: boolean }).polluted).toBeUndefined();
    expect(post.title).toBe('x');
  });

  it('takes the row it is given', () => {
    expect(new Post({ id: 'p1', title: 'Hi' }).title).toBe('Hi');
    expect(Object.keys(new Post({ title: 'Hi' }))).toEqual(['title']);
  });

  it('every entity is a Schema — the derivation chain ends there', () => {
    expect(new Post({ title: 'x' })).toBeInstanceOf(Schema);
    expect(new (Post.pick('title'))({ title: 'x' })).toBeInstanceOf(Schema);
  });
});
