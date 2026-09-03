import { describe, it, expect } from 'vitest';
import { entity } from '../src/entity.js';
import { primary } from '../src/vocabulary/primary.js';
import { text } from '../src/vocabulary/text.js';

// Stand in for an adapter package: augment the open registry exactly as an SQL
// adapter would, from outside the core, via declaration merging. The 'sql'
// namespace below is arbitrary — any adapter-chosen key works the same way.
declare module '../src/entity/EntityAdapters.js' {
  interface FougereEntityAdapters<K extends string> {
    sql?: Partial<Record<K, { columnType?: string; index?: string }>>;
    graphql?: Partial<Record<K, { description?: string }>>;
  }
}

class Article extends entity(
  {
    id: primary(),
    title: text(),
    body: text(),
  },
  {
    adapters: {
      sql: { body: { columnType: 'tsvector', index: 'gin' } },
      graphql: { title: { description: 'The headline' } },
    },
  },
) {}

describe('entity() per-adapter statements', () => {
  it('stores them and exposes them via getAdapters()', () => {
    const h = Article.getAdapters();
    expect(h?.sql?.body).toEqual({ columnType: 'tsvector', index: 'gin' });
    expect(h?.graphql?.title?.description).toBe('The headline');
  });

  it('an entity that names no adapter states nothing to any of them', () => {
    class Plain extends entity({ id: primary(), name: text() }) {}
    expect(Plain.getAdapters()).toEqual({});
  });

  it('pick() carries them, filtered to surviving fields', () => {
    const h = Article.pick('body').getAdapters();
    expect(h?.sql?.body).toEqual({ columnType: 'tsvector', index: 'gin' });
    expect(h?.graphql).toBeUndefined(); // title dropped → what it stated dropped
  });

  it('omit() drops what omitted fields stated', () => {
    const h = Article.omit('body').getAdapters();
    expect(h?.sql).toBeUndefined();
    expect(h?.graphql?.title?.description).toBe('The headline');
  });

  it('rename() remaps the keys with their fields', () => {
    const h = Article.rename({ body: 'content' }).getAdapters() as Record<string, Record<string, unknown>> | undefined;
    expect(h?.sql?.content).toEqual({ columnType: 'tsvector', index: 'gin' });
    expect(h?.sql?.body).toBeUndefined();
  });

  it('partial() and extend() pass them through', () => {
    expect(Article.partial().getAdapters()?.sql?.body?.columnType).toBe('tsvector');
    expect(Article.extend({ extra: text() }).getAdapters()?.graphql?.title?.description).toBe('The headline');
  });

  it('a derivation dropping every named field carries nothing', () => {
    expect(Article.pick('id').getAdapters()).toEqual({});
  });

  it('type-level: only registered adapters / real fields / known options are accepted', () => {
    // @ts-expect-error — 'mongo' is not a registered adapter
    entity({ id: primary() }, { adapters: { mongo: { id: {} } } });

    expect(() =>
      // @ts-expect-error — 'missing' is not a field of this entity
      entity({ id: primary() }, { adapters: { sql: { missing: { columnType: 'x' } } } }),
    ).toThrow(/unknown field `missing`/);

    // @ts-expect-error — 'wat' is not a known sql option
    entity({ id: primary() }, { adapters: { sql: { id: { wat: 1 } } } });

    // Accepted: registered adapter, real field, known option
    entity({ id: primary() }, { adapters: { sql: { id: { columnType: 'uuid' } } } });

    expect(true).toBe(true);
  });
});

describe('EntityAdapterSet refuses what it addresses, and carries the rest', () => {
  it('an adapter not addressed by field name is refused, by name', () => {
    expect(() =>
      // @ts-expect-error — the runtime refusal is the point; the type already says no
      entity({ id: primary(), body: text() }, { adapters: { sql: 'tsvector' } }),
    ).toThrow(/adapters\.sql: expected an object keyed by field name, got string/);
  });

  it('a field entry is the adapter\'s shape and is carried, never judged', () => {
    // `schema` knows no sql option, so a bare string reaches the adapter untouched.
    class Loose extends entity(
      { id: primary(), body: text() },
      // @ts-expect-error — the sql adapter of this test file declares an object
      { adapters: { sql: { body: 'tsvector' } } },
    ) {}
    expect(Loose.getAdapters()?.sql?.body).toBe('tsvector');
  });

  it('an adapter given no field is carried as declared', () => {
    class Empty extends entity({ id: primary() }, { adapters: { sql: {} } }) {}
    expect(Empty.getAdapters()).toEqual({ sql: {} });
  });
});

describe('an adapter given nothing', () => {
  it('is refused by name, rather than blowing up on a read further down', () => {
    expect(() => entity(
      { id: primary(), title: text() },
      { adapters: { sql: undefined } } as never,
    )).toThrow('adapters.sql: expected an object keyed by field name, got undefined.');
  });
});
