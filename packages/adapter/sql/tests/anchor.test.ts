/**
 * A schema is either an ANCHOR — it holds rows of its own — or an ANSWER, a shape of another's.
 *
 * The entity says which; this adapter says what to emit for it. Nothing here is read from
 * the app's config, so a frond stays mountable without its host knowing that one of its
 * entities is a table.
 */
import { describe, it, expect } from 'vitest';
import { entity, primary, text } from '@fougere/schema';
import { toTables } from '../src/index.js';

class Book extends entity({ id: primary(), title: text(), isbn: text() }) {}

const hosting = (name: string, entityClass: unknown) => ({
  fronds: [{ name: 'catalog', entities: [{ name, entityClass }] }],
});

const tablesOf = (app: unknown) => toTables(app as never, (n) => `${n}s`).map((t) => t.name);

describe('whose rows a schema holds', () => {
  it('a root is an anchor, and states nothing to be one', () => {
    expect(tablesOf(hosting('book', Book))).toEqual(['books']);
  });

  it('a derivation that narrowed its origin is an answer, and makes no table', () => {
    class BookCard extends Book.pick('id', 'title') {}

    expect(tablesOf(hosting('bookCard', BookCard))).toEqual([]);
  });

  it('a narrowing is an answer however deep the chain — the origin is still the root', () => {
    class BookCard extends Book.pick('id', 'title') {}
    class Titles extends BookCard.pick('title') {}

    expect(tablesOf(hosting('titles', Titles))).toEqual([]);
  });

  it("a derivation that anchors holds rows of its own, and gets a table", () => {
    class Archive extends Book.pick('id', 'title').anchor() {}

    expect(tablesOf(hosting('archive', Archive))).toEqual(['archives']);
  });

  it('an anchor owes nothing beyond saying so — no field is asked of it', () => {
    class Archive extends Book.extend({ archivedBy: text() }).anchor() {}

    expect(tablesOf(hosting('archive', Archive))).toEqual(['archives']);
  });

});

describe('a derivation that only widened', () => {
  it('is an answer like any other — a shape may carry a field its origin has not', () => {
    class Excerpted extends Book.extend({ excerpt: text() }) {}

    expect(tablesOf(hosting('excerpted', Excerpted))).toEqual([]);
  });

  it('holds rows the moment it says so, and not before', () => {
    class Archive extends Book.extend({ archivedBy: text() }).anchor() {}

    expect(tablesOf(hosting('archive', Archive))).toEqual(['archives']);
  });

  it('a bare subclass was cut from nothing, so it is the entity itself', () => {
    class Plain extends Book {}

    expect(tablesOf(hosting('plain', Plain))).toEqual(['plains']);
  });
});

/** Two entries for one name are two `CREATE TABLE` for one table. */
describe('one entity registered twice', () => {
  class User extends entity({ id: primary(), email: text() }) {}

  it('makes one table, not two', () => {
    const app = {
      fronds: [
        { name: 'account', entities: [{ name: 'user', entityClass: User }] },
        { name: 'auth', entities: [{ name: 'user', entityClass: User }] },
      ],
    };

    expect(tablesOf(app)).toEqual(['users']);
  });

  it('brings in what a frond an extension brought holds', () => {
    class Session extends entity({ id: primary(), userId: text() }) {}
    const app = {
      fronds: [
        { name: 'account', entities: [{ name: 'user', entityClass: User }] },
        { name: 'auth', entities: [{ name: 'session', entityClass: Session }] },
      ],
    };

    expect(tablesOf(app).sort()).toEqual(['sessions', 'users']);
  });
});
