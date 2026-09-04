import { describe as group, it, expect } from 'vitest';
import { entity } from '../src/entity.js';
import { primary } from '../src/vocabulary/primary.js';
import { text } from '../src/vocabulary/text.js';
import { number } from '../src/vocabulary/number.js';
import { optional } from '../src/vocabulary/optional.js';
import { created } from '../src/vocabulary/created.js';
import { ref } from '../src/vocabulary/ref.js';
import { many } from '../src/vocabulary/many.js';
import { json } from '../src/vocabulary/json.js';
import { list } from '../src/vocabulary/list.js';
import { email } from '../src/vocabulary/email.js';
import { readOnly } from '../src/vocabulary/readOnly.js';
import { Card } from '../src/projection/card/Card.js';
import { Bundle } from '../src/projection/card/Bundle.js';
import { type SchemaView } from '../src/SchemaView.js';
import { type EntityConstructor, type Relation } from '../src/axis/role/Relation.js';
import { type RoleRules } from '../src/axis/role/Role.js';
import { type RoleDescriptor, type RelationDescriptor } from '../src/projection/card/Descriptor.js';

class Author extends entity({ id: primary() }) {}
class Tag extends entity({ id: primary() }) {}

class Post extends entity({
  id: primary(),
  title: text({ min: 1 }),
  views: number({ integer: true, min: 0 }),
  rating: optional(number()),
  createdAt: created(),
  author: ref(Author),
  tags: many(Tag),
}) {}

group('Card.fromSchema — schema to JSON Schema card', () => {
  const card = Card.fromSchema(Post, 'post').descriptor;

  it('is a versioned, vendored JSON Schema object', () => {
    expect(card.type).toBe('object');
    expect(card['x-fougere-version']).toBe(1);
    expect(card['x-fougere-vendor']).toBe('fougere');
    expect(card.title).toBe('post');
  });

  it('maps shape to JSON Schema keywords', () => {
    expect(card.properties.title).toEqual({ type: 'string', minLength: 1 });
    expect(card.properties.views).toEqual({ type: 'integer', minimum: 0 });
  });

  it('folds nullable into a [T, null] type union', () => {
    expect(card.properties.rating.type).toEqual(['number', 'null']);
  });

  it('emits a date as string + format, with no boundary (it is the derived default)', () => {
    expect(card.properties.createdAt).toEqual({
      type: 'string',
      format: 'date-time',
      'x-fougere': { lifecycle: { create: 'now', update: 'forbidden' } },
    });
  });

  it('carries a relation as a NAME under x-fougere (one and many)', () => {
    expect(card.properties.author).toEqual({
      type: 'string',
      'x-fougere': { role: { relation: { to: 'author', kind: 'one' } } },
    });
    expect(card.properties.tags).toEqual({
      type: 'array',
      'x-fougere': { role: { relation: { to: 'tag', kind: 'many' } } },
    });
  });

  it('lists only caller-supplied fields as required', () => {
    expect(card.required).toEqual(['title', 'views', 'author']);
  });

  it('is pure data — survives a JSON round-trip unchanged (no function leaked)', () => {
    expect(JSON.parse(JSON.stringify(card))).toEqual(card);
  });
});

group('Card.toSchema — card to working schema', () => {
  const wire = JSON.parse(JSON.stringify(Card.fromSchema(Post, 'post').descriptor));
  const Remote = Card.fromDescriptor(wire).toSchema();

  it('rebuilds live validation (~standard) locally', () => {
    expect(Remote['~standard'].vendor).toBe('fougere');
  });

  it('validates and re-derives the date codec from format (string → Date)', () => {
    const result = Remote.validate({
      id: 'p1', title: 'Hi', views: 3, author: 'a1',
      createdAt: '2026-06-01T10:00:00.000Z',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.createdAt).toBeInstanceOf(Date);
      expect(result.data.tags).toEqual([]); // many relation fills empty
    }
  });

  it('enforces the reconstructed shape constraints', () => {
    expect(Remote.validate({ id: 'p1', title: '', views: 3, author: 'a1' }).success).toBe(false);
    expect(Remote.validate({ id: 'p1', title: 'Hi', views: -1, author: 'a1' }).success).toBe(false);
  });

  it('keeps the relation kind and a name-bearing stand-in target', () => {
    const author = Remote.getFields().author;
    expect(author.role?.relation?.kind).toBe('one');
    expect((author.role!.relation!.to() as { name: string }).name).toBe('author');
  });

  it('round-trips through a schema and back to a card', () => {
    expect(Card.fromSchema(Remote, 'post').descriptor).toEqual(Card.fromSchema(Post, 'post').descriptor);
  });

  it('a value list and a format travel and still validate after reconstruction', () => {
    class Profile extends entity({
      id: primary(),
      mail: email(),
      tags: optional(list(text({ min: 1 }), { max: 3 })),
    }) {}
    const wire = JSON.parse(JSON.stringify(Card.fromSchema(Profile, 'profile').descriptor));
    expect(wire.properties.mail).toEqual({ type: 'string', format: 'email' });
    expect(wire.properties.tags.type).toEqual(['array', 'null']); // a value list folds nullable
    expect(wire.properties.tags.items).toEqual({ type: 'string', minLength: 1 });

    const Remote = Card.fromDescriptor(wire).toSchema();
    expect(Card.fromSchema(Remote, 'profile').descriptor).toEqual(Card.fromSchema(Profile, 'profile').descriptor);
    expect(Remote.validate({ mail: 'a@b.co', tags: ['x'] }).success).toBe(true);
    expect(Remote.validate({ mail: 'a@b.co', tags: [''] }).success).toBe(false);
    expect(Remote.validate({ mail: 'nope', tags: ['x'] }).success).toBe(false);
    // a bare many() relation round-trips as an array WITHOUT items — the card always wrote
    // `type: 'array'` for it, and now the field it rebuilds says the same thing it did.
    expect(Card.fromDescriptor(
      JSON.parse(JSON.stringify(Card.fromSchema(Post, 'post').descriptor)),
    ).toSchema().getFields().tags.shape).toEqual({ type: 'array' });
  });

  it('an embedded value object (json(Entity)) travels and still validates after reconstruction', () => {
    class Address extends entity({ street: text({ min: 1 }), zip: text() }) {}
    class Customer extends entity({ id: primary(), address: json(Address) }) {}
    const wire = JSON.parse(JSON.stringify(Card.fromSchema(Customer, 'customer').descriptor));
    expect(wire.properties.address.properties.street).toEqual({ type: 'string', minLength: 1 });
    expect(wire.properties.address.required).toEqual(['street', 'zip']);

    const RemoteCustomer = Card.fromDescriptor(wire).toSchema();
    expect(Card.fromSchema(RemoteCustomer, 'customer').descriptor)
      .toEqual(Card.fromSchema(Customer, 'customer').descriptor);
    expect(RemoteCustomer.validate({ address: { street: 's', zip: 'z' } }).success).toBe(true);
    expect(RemoteCustomer.validate({ address: { street: 's' } }).success).toBe(false);
  });
});

group('Bundle — self-contained $defs map', () => {
  const bundle = Bundle.fromSchemas({ author: Author, tag: Tag, post: Post }).descriptor;

  it('packs every entity under $defs, keyed by name', () => {
    expect(Object.keys(bundle.$defs).sort()).toEqual(['author', 'post', 'tag']);
    expect(bundle['x-fougere-version']).toBe(1);
    expect(bundle.$defs.post.properties.author['x-fougere']?.role?.relation?.to).toBe('author');
  });

  it('survives a JSON round-trip — pure data, no function leaked', () => {
    expect(JSON.parse(JSON.stringify(bundle))).toEqual(bundle);
  });

  it('resolves a relation $ref to the REAL reconstructed target (feeds adapters)', () => {
    const wire = JSON.parse(JSON.stringify(bundle));
    const schemas = Bundle.fromDescriptor(wire).toSchemas();

    const authorTarget = schemas.post.getFields().author.role!.relation!.to();
    // Not a {name} stand-in: the actual reconstructed Author, with its fields.
    expect(authorTarget).toBe(schemas.author);
    // `relation.to()` answers an `EntityConstructor` — a bare construct signature,
    // by design (role.ts must not depend on the carrier). Reading its fields means
    // saying, here, that the reconstructed target does carry them.
    expect(Object.keys((authorTarget as unknown as SchemaView).getFields())).toEqual(['id']);
  });

  it('a many relation resolves its element target too', () => {
    const schemas = Bundle.fromDescriptor(JSON.parse(JSON.stringify(bundle))).toSchemas();
    expect(schemas.post.getFields().tags.role!.relation!.to()).toBe(schemas.tag);
  });

  it('round-trips through schemas and back to a bundle', () => {
    const schemas = Bundle.fromDescriptor(JSON.parse(JSON.stringify(bundle))).toSchemas();
    expect(Bundle.fromSchemas(schemas).descriptor).toEqual(bundle);
  });

  it('handles a circular relation by reference (no infinite nesting)', () => {
    // The thunk defers the value, not the type: inferring `Node` would require `Node`.
    // Annotating it cuts the loop — `ref()` answers `Field<string>` whatever its target.
    class Node extends entity({ id: primary(), parent: optional(ref((): EntityConstructor => Node)) }) {}
    const set = Bundle.fromDescriptor(
      JSON.parse(JSON.stringify(Bundle.fromSchemas({ node: Node }).descriptor)),
    ).toSchemas();
    expect(set.node.getFields().parent.role!.relation!.to()).toBe(set.node);
  });

  it('keeps a name stand-in for a target absent from the set', () => {
    const onlyPost = Bundle.fromDescriptor(
      JSON.parse(JSON.stringify(Bundle.fromSchemas({ post: Post }).descriptor)),
    ).toSchemas();
    // author/tag not in the set → unresolved $ref → name stand-in
    expect((onlyPost.post.getFields().author.role!.relation!.to() as { name: string }).name).toBe('author');
  });
});

/**
 * `required` and the judge answer the same question, and used to disagree.
 *
 * `validateFields` lets a read-only field be absent — it is server-owned, so its
 * absence from client input is never "Required" (the OpenAPI readOnly+required
 * stance). `isRequired` only consulted `lifecycle.create` and `many`, so the card
 * listed it anyway. A consumer that reads the card literally — the whole point of
 * a portable document — then supplies the field and is told `Read-only`.
 */
group('required and the judge answer the same question', () => {
  class Owned extends entity({
    id: primary(),
    title: text({ min: 1 }),
    authorId: readOnly(text()),
  }) {}

  it('leaves a read-only field out of required, like the judge does', () => {
    expect(Owned.validate({ title: 'hello' }).success).toBe(true);
    expect(Card.fromSchema(Owned, 'owned').descriptor.required).toEqual(['title']);
  });
});

/**
 * The card names what it KEEPS from a role, and so do the two functions that write and
 * read it. A member added to `RoleRules` must be decided on, not carried by a subtraction:
 * `describeRole` enumerates its members, so a type saying otherwise would promise a key
 * the card never carries — across a process and a language, where nothing checks back.
 */
group('every member of a role is accounted for on the wire', () => {
  // The wire names groups BY KIND (`unique`), memory holds them in one list (`rules`) —
  // `describeRole` is that projection. The alias is stated here so the check stays total.
  type OnTheWire<K> = K extends 'rules' ? 'unique' : K;
  type Accounted<Live, Wire> = Exclude<OnTheWire<keyof Live>, keyof Wire> extends never
    ? true
    : ['this member reaches no card:', Exclude<OnTheWire<keyof Live>, keyof Wire>];

  it('leaves no member of RoleRules or Relation unaccounted for', () => {
    const role: Accounted<RoleRules, RoleDescriptor> = true;
    const relation: Accounted<Relation, RelationDescriptor> = true;
    expect([role, relation]).toEqual([true, true]);
  });
});

group('a view says what it is a view of', () => {
  class Note extends entity({ id: primary(), title: text(), body: text() }) {}

  it('carries the origin and what the cut left', () => {
    const card = Card.fromSchema(Note.pick('id', 'title'));
    expect(card.origin).toEqual({
      from: 'Note',
      nameOf: { id: 'id', title: 'title', body: null },
    });
    expect(card.descriptor['x-fougere-derived']).toEqual(card.origin);
  });

  it('separates two views an identical title used to merge', () => {
    const a = Card.fromSchema(Note.pick('id', 'title')).descriptor;
    const b = Card.fromSchema(Note.pick('id', 'body')).descriptor;
    expect(a.title).toBe(b.title);
    expect(a['x-fougere-derived']).not.toEqual(b['x-fougere-derived']);
  });

  it('survives JSON — a dropped field is null, never erased', () => {
    const card = JSON.parse(JSON.stringify(Card.fromSchema(Note.pick('id', 'title')).descriptor));
    expect(card['x-fougere-derived'].nameOf).toEqual({ id: 'id', title: 'title', body: null });
  });

  it('says nothing on a declaration that derives from nothing', () => {
    expect(Card.fromSchema(Note).origin).toBeUndefined();
  });
});

group('a card is admitted before it becomes a judge', () => {
  const card = () => ({
    type: 'object' as const,
    properties: { id: { type: 'string' as const } },
    'x-fougere-version': 1 as const,
    'x-fougere-vendor': 'fougere' as const,
  });

  it('reads a well-formed one', () => {
    expect(Card.fromDescriptor(card()).toSchema().getFields()).toHaveProperty('id');
  });

  it('refuses a version it does not speak, and an absent one', () => {
    expect(() => Card.fromDescriptor({ ...card(), 'x-fougere-version': 2 } as never).toSchema()).toThrow(/speaks 1/);
    expect(() => Card.fromDescriptor({ ...card(), 'x-fougere-version': undefined } as never).toSchema()).toThrow(/speaks 1/);
  });

  it('refuses a schema that is not its fields', () => {
    expect(() => Card.fromDescriptor({ ...card(), properties: undefined } as never).toSchema())
      .toThrow(/no `properties` object/);
  });

  it('refuses a relation whose kind is not one of the two', () => {
    const bad = { ...card(), properties: { a: { type: 'string' as const, 'x-fougere': { role: { relation: { to: 'post', kind: 'plusieurs' } } } } } };
    expect(() => Card.fromDescriptor(bad as never).toSchema()).toThrow(/role\.relation\.kind is "plusieurs"/);
  });

  it('refuses an onDelete outside the closed list', () => {
    const bad = { ...card(), properties: { a: { type: 'string' as const, 'x-fougere': { role: { relation: { to: 'post', kind: 'one', onDelete: 'boom' } } } } } };
    expect(() => Card.fromDescriptor(bad as never).toSchema()).toThrow(/role\.relation\.onDelete is "boom"/);
  });

  // lifecycle and boundary describe themselves as themselves, so their own judge reads the wire.
  it('refuses a lifecycle and a boundary through the judge that already reads them', () => {
    const lifecycle = { ...card(), properties: { a: { type: 'string' as const, 'x-fougere': { lifecycle: { update: 'jamais' } } } } };
    expect(() => Card.fromDescriptor(lifecycle as never).toSchema()).toThrow(/lifecycle\.update/);
    const boundary = { ...card(), properties: { a: { type: 'string' as const, 'x-fougere': { boundary: { in: 42 } } } } };
    expect(() => Card.fromDescriptor(boundary as never).toSchema()).toThrow(/boundary\.in/);
  });
});
