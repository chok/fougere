import { describe, expect, it } from 'vitest';
import {
  created,
  entity,
  Field,
  list,
  oneOf,
  optional,
  primary,
  Role,
  Schema,
  text,
  updated,
} from '../src/index.js';
import { FieldDeclarationValidator } from '../src/validator/FieldDeclarationValidator.js';

/**
 * The constructor is the only way to obtain a field, so it is where a field is validated —
 * and where hostile input stops. Both halves are pinned here because both were reachable:
 * `new Field({})` used to be legal from any caller without a compiler, and assigning the
 * slots wholesale used to be a one-line simplification with a prototype hole under it.
 */
describe('the field facade', () => {
  it('refuses what is not a field, and names the key when it was given one', () => {
    expect(() => new Field({} as never)).toThrow(/shape: Every field states a shape/);
    expect(() => new Field({} as never, 'vide')).toThrow(/Field 'vide': shape:/);
    expect(() => entity({ id: primary(), vide: {} as never })).toThrow(/Field 'vide': shape:/);
  });

  it('validates every axis against its own vocabulary, and names the one that failed', () => {
    const shape = { type: 'string' } as const;
    const refused: readonly (readonly [object, string])[] = [
      [{ shape, lifecycle: 'nawak' }, 'lifecycle: Instance type "string" is invalid. Expected "object".'],
      [{ shape, lifecycle: { create: 'nawak' } }, 'lifecycle.create: Instance does not match any of ["now","optional"].'],
      [{ shape, lifecycle: { update: 'nawak' } }, 'lifecycle.update: Instance does not match any of ["now","forbidden"].'],
      [{ shape, lifecycle: { create: { nawak: 1 } } }, 'lifecycle.create.nawak: Instance does not match any of ["value","generate"].'],
      [{ shape, lifecycle: { craete: 'now' } }, 'lifecycle.craete: Instance does not match any of ["create","update"].'],
      [{ shape, role: 'nawak' }, 'role: Instance type "string" is invalid. Expected "object".'],
      [{ shape, role: { relation: { kind: 'nawak', to: () => ({}) } } }, 'role.relation.kind: Instance does not match any of ["one","many"].'],
      [{ shape, role: { relation: { kind: 'one' } } }, 'role.relation: Instance does not have required property "to".'],
      [{ shape, role: { relation: { kind: 'one', to: 'Post' } } }, 'role.relation.to: Expected a function returning the target entity'],
      [{ shape, role: { unique: 'yes' } }, 'role.unique: Instance type "string" is invalid. Expected "boolean".'],
      [{ shape, boundary: { in: { nawak: 'x' } } }, 'boundary.in.nawak: Instance does not match any of ["decode"].'],
      [{ shape, meta: 42 }, 'meta: Instance type "number" is invalid. Expected "object".'],
    ];
    for (const [init, message] of refused) {
      expect(() => new Field(init as never)).toThrow(message);
    }
  });

  // The facade judges the FORM of a generator, never the name: `Generators.register` may
  // still be called after `entity()`, and the registry refuses an unknown name at apply.
  it('refuses a generator that is not a name, and takes a name it does not answer yet', () => {
    const shape = { type: 'string' } as const;
    const refused: readonly (readonly [unknown, string])[] = [
      [3, 'lifecycle.create.generate: Instance type "number" is invalid. Expected "string".'],
      [undefined, 'lifecycle.create: Instance does not have at least 1 properties.'],
      [() => 'x', 'lifecycle.create.generate: Expected a JSON value — got function'],
    ];
    for (const [generate, message] of refused) {
      expect(() => new Field({ shape, lifecycle: { create: { generate } } } as never)).toThrow(message);
    }

    expect(() => new Field({ shape, lifecycle: { create: { generate: 'ulid' } } } as never)).not.toThrow();
  });

  it('reports every fault at once, not the first', () => {
    const verdict = FieldDeclarationValidator.of({ shape: 42, lifecycle: { update: 'nawak' }, meta: 7 }).verdict;
    expect(verdict.success).toBe(false);
    if (!verdict.success) {
      expect(verdict.errors.map((e) => e.path)).toEqual([['shape'], ['lifecycle', 'update'], ['meta']]);
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

  it('refuses a key no axis states, naming the ones that are legal', () => {
    expect(() => new Field({ shape: { type: 'string' }, nawak: 42 } as never)).toThrow(
      'nawak: Instance does not match any of ["shape","role","lifecycle","boundary","meta"].',
    );
  });

  it('refuses a card carrying __proto__, and pollutes nothing on its way out', () => {
    // `Object.assign(this, init)` would copy through [[Set]], firing the `__proto__`
    // setter: the field would lose `with` and gain whatever the sender put there.
    const hostile = JSON.parse('{"shape":{"type":"string"},"__proto__":{"polluted":true}}');

    expect(() => new Field(hostile)).toThrow('__proto__: Instance does not match any of');
    expect(({} as { polluted?: boolean }).polluted).toBeUndefined();
  });

  it('a field built from the vocabulary is the same thing', () => {
    expect(text()).toBeInstanceOf(Field);
    expect(text().with({ meta: { description: 'x' } }).shape).toEqual({ type: 'string' });
  });
});

describe('the schema facade', () => {
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
