/**
 * The storage projection stands on the fields, not on the class.
 *
 * `toTable` reads the axes — shape for the column type, role for keys and FKs, lifecycle
 * for defaults. None of that needs a live class, so a card must describe the same table.
 * What a card CANNOT carry is a live relation target, and the fallback is asserted here
 * rather than left to be discovered: it is the one place the two paths legitimately differ.
 */
import { describe as suite, it, expect } from 'vitest';
import {
  entity, primary, text, number, bool, date, json, oneOf, ref,
  created, updated, immutable, optional, nullable, unique, indexed,
  describe as describeCard, reconstructSet, describeSet,
} from '@fougere/schema';
import { toTable, toTables, toTableName } from '../src/table.js';

class Author extends entity({
  id: primary(),
  name: text({ min: 1 }),
}) {}

class Post extends entity({
  id: primary(),
  slug: unique(text({ min: 1, max: 80 })),
  title: text({ min: 1, max: 160 }),
  summary: optional(text()),
  body: nullable(text()),
  views: indexed(number({ integer: true, min: 0 })),
  featured: bool({ default: false }),
  meta: json(),
  authorId: ref(Author),
  status: oneOf('draft', 'published', { default: 'draft' }),
  createdAt: created(),
  updatedAt: updated(),
  publishedAt: immutable(optional(date())),
}, {
  unique: [['slug', 'authorId']],
}) {}

suite('a table is described from a card as from a class', () => {
  it('produces the same columns, keys and constraints', () => {
    const fromClass = toTable('posts', Post);
    const fromCard = toTable('posts', describeCard(Post));

    // The FK target is the documented exception: a LONE card has no live target, so
    // `referenceFor` falls back to the name convention. Compared separately below.
    const withoutRefs = (t: typeof fromClass) =>
      ({ ...t, columns: t.columns.map(({ references: _r, ...rest }) => rest) });

    expect(withoutRefs(fromCard)).toEqual(withoutRefs(fromClass));
    // The composite constraint is what a per-field boolean could not have carried.
    expect(fromCard.uniqueGroups).toEqual([['slug', 'author_id']]);
  });

  it('resolves the FK through a bundle, and falls back to the convention alone', () => {
    // A lone card: the target is a name stand-in, so the table name is derived and the
    // key column assumed to be `id` — right whenever the target follows the convention.
    const lone = toTable('posts', describeCard(Post));
    expect(lone.columns.find((c) => c.name === 'author_id')?.references)
      .toEqual({ table: 'authors', column: 'id' });

    // A bundle: `reconstructSet` hands back the real sibling, so the FK is read off it.
    const { post } = reconstructSet(describeSet({ post: Post, author: Author }));
    expect(toTable('posts', post!).columns.find((c) => c.name === 'author_id')?.references)
      .toEqual(toTable('posts', Post).columns.find((c) => c.name === 'author_id')?.references);
  });

  it('points a two-word target at the table the same pass creates', () => {
    // The fallback derives the FK's table from the name the card carries, so that name
    // must be the one the entity is filed under. `describe` used to lowercase it whole:
    // `AuthorUser` crossed as `authoruser`, and `toTableName` turned that into
    // `authorusers` while the table being created was `author_users`. One word hid it —
    // `author` folds to itself either way — so the two paths agreed everywhere the repo
    // looked, and the reference pointed at nothing the day an entity had two.
    class AuthorUser extends entity({ id: primary(), name: text() }) {}
    class Note extends entity({ id: primary(), authorUserId: ref(AuthorUser) }) {}

    const fks = (app: Parameters<typeof toTables>[0]) =>
      toTables(app, toTableName).flatMap((t) =>
        t.columns.filter((c) => c.references).map((c) => `${t.name}.${c.name} -> ${c.references!.table}`));

    const live = fks({ fronds: [{ name: 'n', entities: [
      { name: 'authorUser', entityClass: AuthorUser },
      { name: 'note', entityClass: Note },
    ] }] });
    const card = fks({ fronds: [{ name: 'n', entities: [
      { name: 'authorUser', entityClass: describeCard(AuthorUser, 'authorUser') },
      { name: 'note', entityClass: describeCard(Note, 'note') },
    ] }] });

    expect(live).toEqual(['notes.author_user_id -> author_users']);
    expect(card).toEqual(live);
  });
});
