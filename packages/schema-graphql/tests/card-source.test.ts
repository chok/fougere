/**
 * The GraphQL projection stands on the fields and the NAME, not on the class object.
 *
 * Relations are wired by looking the target up in a registry. That registry was keyed by
 * the entity class OBJECT, so a target that was not the very object registered missed and
 * hit `if (!targetEntry) continue` — the relation left the schema without a word. An
 * entity rebuilt from a card is exactly that case: its `to()` leaves a `{ name }` stand-in.
 *
 * Keyed by name, both sources resolve. These tests hold the pair: same schema from cards
 * as from classes, relations included.
 */
import SchemaBuilder from '@pothos/core';
import { describe as suite, expect, it } from 'vitest';
import { entity, primary, ref, many, text, number, describe as describeCard, type EntityConstructor } from '@fougere/schema';
import { registerAll } from '../src/auto-register.js';

class Author extends entity({
  id: primary(),
  name: text(),
  // The thunk defers the VALUE, not the type — annotating it cuts the inference cycle
  // `Author.posts` ↔ `Post.authorId` (see `EntityConstructor`'s note in @fougere/schema).
  posts: many((): EntityConstructor => Post),
}) {}

class Post extends entity({
  id: primary(),
  title: text(),
  views: number({ integer: true }),
  authorId: ref(Author),
}) {}

/** The app shape both sources produce — only `entityClass` differs. */
function fakeApp(authorSchema: unknown, postSchema: unknown) {
  const facade = { list: async () => [], findById: async () => undefined };
  return {
    fronds: [{
      name: 'blog',
      entities: [
        { name: 'author', entityClass: authorSchema },
        { name: 'post', entityClass: postSchema },
      ],
      handlers: [
        { address: 'author', operations: new Map() },
        { address: 'post', operations: new Map() },
      ],
      presenters: [],
    }],
    resolve: () => { throw new Error('no presenter'); },
    facadeFor: () => facade,
  } as any;
}

function schemaFrom(app: any) {
  const builder = new SchemaBuilder({});
  builder.queryType({});
  builder.mutationType({});
  registerAll(builder, app);
  return builder.toSchema();
}

const fieldNamesOf = (schema: any, type: string) =>
  Object.keys((schema.getTypeMap()[type] as any).getFields()).sort();

suite('the GraphQL projection reads a card as readily as a class', () => {
  it('registers the same types and fields', () => {
    const fromClasses = schemaFrom(fakeApp(Author, Post));
    const fromCards = schemaFrom(fakeApp(describeCard(Author, 'author'), describeCard(Post, 'post')));

    expect(fieldNamesOf(fromCards, 'Post')).toEqual(fieldNamesOf(fromClasses, 'Post'));
    expect(fieldNamesOf(fromCards, 'Author')).toEqual(fieldNamesOf(fromClasses, 'Author'));
  });

  it('wires the relation both ways, from cards', () => {
    const schema = schemaFrom(fakeApp(describeCard(Author, 'author'), describeCard(Post, 'post')));

    // ref → N:1. `authorId` yields an `author` field typed Author, and its absence is what
    // the object-keyed registry produced without complaining.
    const postFields = (schema.getTypeMap()['Post'] as any).getFields();
    expect(Object.keys(postFields)).toContain('author');
    expect(String(postFields.author.type)).toBe('Author!');   // the FK is not nullable

    // many → 1:N, which needs the TARGET's fields to find the reverse FK — read off the
    // registry, since a card's stand-in target has none to walk.
    const authorFields = (schema.getTypeMap()['Author'] as any).getFields();
    expect(Object.keys(authorFields)).toContain('posts');
    expect(String(authorFields.posts.type)).toBe('[Post!]');
  });

  it('resolves a target whose name is cased differently on each side', () => {
    // The scan yields the registration name, `describe` lowercases a relation target
    // wholesale. Case-folding the key is what keeps one registry serving both.
    class AuthorUser extends entity({ id: primary(), name: text() }) {}
    class Note extends entity({ id: primary(), authorUserId: ref(AuthorUser) }) {}

    const facade = { list: async () => [], findById: async () => undefined };
    const schema = schemaFrom({
      fronds: [{
        name: 'notes',
        entities: [
          { name: 'authorUser', entityClass: describeCard(AuthorUser, 'authorUser') },
          { name: 'note', entityClass: describeCard(Note, 'note') },
        ],
        handlers: [
          { address: 'authorUser', operations: new Map() },
          { address: 'note', operations: new Map() },
        ],
        presenters: [],
      }],
      resolve: () => { throw new Error('no presenter'); },
      facadeFor: () => facade,
    } as any);

    const noteFields = (schema.getTypeMap()['Note'] as any).getFields();
    expect(Object.keys(noteFields)).toContain('authorUser');
    expect(String(noteFields.authorUser.type)).toBe('AuthorUser!');
  });
});
