import { describe as group, it, expect } from 'vitest';
import {
  entity, primary, text, number, optional, created, ref, many, json, list, email, readOnly,
  describe, reconstruct, describeSet, reconstructSet,
  type SchemaView, type EntityConstructor,
} from '../src/index.js';

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

group('describe — schema → JSON Schema card', () => {
  const card = describe(Post, 'post');

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

group('reconstruct — card → working schema', () => {
  const wire = JSON.parse(JSON.stringify(describe(Post, 'post')));
  const Remote = reconstruct(wire);

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

  it('round-trips: describe ∘ reconstruct ∘ describe = describe', () => {
    expect(describe(Remote, 'post')).toEqual(describe(Post, 'post'));
  });

  it('a value list and a format travel and still validate after reconstruct', () => {
    class Profile extends entity({
      id: primary(),
      mail: email(),
      tags: optional(list(text({ min: 1 }), { max: 3 })),
    }) {}
    const wire = JSON.parse(JSON.stringify(describe(Profile, 'profile')));
    expect(wire.properties.mail).toEqual({ type: 'string', format: 'email' });
    expect(wire.properties.tags.type).toEqual(['array', 'null']); // a value list folds nullable
    expect(wire.properties.tags.items).toEqual({ type: 'string', minLength: 1 });

    const Remote = reconstruct(wire);
    expect(describe(Remote, 'profile')).toEqual(describe(Profile, 'profile'));
    expect(Remote.validate({ mail: 'a@b.co', tags: ['x'] }).success).toBe(true);
    expect(Remote.validate({ mail: 'a@b.co', tags: [''] }).success).toBe(false);
    expect(Remote.validate({ mail: 'nope', tags: ['x'] }).success).toBe(false);
    // a bare many() relation round-trips as an array WITHOUT items — the card always wrote
    // `type: 'array'` for it, and now the field it rebuilds says the same thing it did.
    expect(reconstruct(JSON.parse(JSON.stringify(describe(Post, 'post')))).getFields().tags.shape).toEqual({ type: 'array' });
  });

  it('an embedded value object (json(Entity)) travels and still validates after reconstruct', () => {
    class Address extends entity({ street: text({ min: 1 }), zip: text() }) {}
    class Customer extends entity({ id: primary(), address: json(Address) }) {}
    const wire = JSON.parse(JSON.stringify(describe(Customer, 'customer')));
    expect(wire.properties.address.properties.street).toEqual({ type: 'string', minLength: 1 });
    expect(wire.properties.address.required).toEqual(['street', 'zip']);

    const RemoteCustomer = reconstruct(wire);
    expect(describe(RemoteCustomer, 'customer')).toEqual(describe(Customer, 'customer'));
    expect(RemoteCustomer.validate({ address: { street: 's', zip: 'z' } }).success).toBe(true);
    expect(RemoteCustomer.validate({ address: { street: 's' } }).success).toBe(false);
  });
});

group('describeSet / reconstructSet — self-contained $defs bundle', () => {
  const bundle = describeSet({ author: Author, tag: Tag, post: Post });

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
    const schemas = reconstructSet(wire);

    const authorTarget = schemas.post.getFields().author.role!.relation!.to();
    // Not a {name} stand-in: the actual reconstructed Author, with its fields.
    expect(authorTarget).toBe(schemas.author);
    // `relation.to()` answers an `EntityConstructor` — a bare construct signature,
    // by design (role.ts must not depend on the carrier). Reading its fields means
    // saying, here, that the reconstructed target does carry them.
    expect(Object.keys((authorTarget as unknown as SchemaView).getFields())).toEqual(['id']);
  });

  it('a many relation resolves its element target too', () => {
    const schemas = reconstructSet(JSON.parse(JSON.stringify(bundle)));
    expect(schemas.post.getFields().tags.role!.relation!.to()).toBe(schemas.tag);
  });

  it('round-trips: describeSet ∘ reconstructSet = describeSet', () => {
    const schemas = reconstructSet(JSON.parse(JSON.stringify(bundle)));
    expect(describeSet(schemas)).toEqual(bundle);
  });

  it('handles a circular relation by reference (no infinite nesting)', () => {
    // The thunk defers the value, not the type: inferring `Node` would require `Node`.
    // Annotating it cuts the loop — `ref()` answers `Field<string>` whatever its target.
    class Node extends entity({ id: primary(), parent: optional(ref((): EntityConstructor => Node)) }) {}
    const set = reconstructSet(JSON.parse(JSON.stringify(describeSet({ node: Node }))));
    expect(set.node.getFields().parent.role!.relation!.to()).toBe(set.node);
  });

  it('keeps a name stand-in for a target absent from the set', () => {
    const onlyPost = reconstructSet(JSON.parse(JSON.stringify(describeSet({ post: Post }))));
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
    expect(describe(Owned, 'owned').required).toEqual(['title']);
  });
});
