import { describe, it, expect } from 'vitest';
import { entity } from '../src/entity.js';
import { primary } from '../src/vocabulary/primary.js';
import { text } from '../src/vocabulary/text.js';

// Stand in for an adapter package: augment the open registry exactly as an SQL
// adapter would, from outside the core, via declaration merging. The 'sql'
// namespace below is arbitrary — any adapter-chosen key works the same way.
declare module '../src/Hints.js' {
  interface FougereHints<K extends string> {
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
    hints: {
      sql: { body: { columnType: 'tsvector', index: 'gin' } },
      graphql: { title: { description: 'The headline' } },
    },
  },
) {}

describe('entity() per-consumer hints', () => {
  it('stores hints and exposes them via getHints()', () => {
    const h = Article.getHints();
    expect(h?.sql?.body).toEqual({ columnType: 'tsvector', index: 'gin' });
    expect(h?.graphql?.title?.description).toBe('The headline');
  });

  it('an entity with no hints returns undefined', () => {
    class Plain extends entity({ id: primary(), name: text() }) {}
    expect(Plain.getHints()).toBeUndefined();
  });

  it('pick() carries hints, filtered to surviving fields', () => {
    const h = Article.pick('body').getHints();
    expect(h?.sql?.body).toEqual({ columnType: 'tsvector', index: 'gin' });
    expect(h?.graphql).toBeUndefined(); // title dropped → its hints dropped
  });

  it('omit() drops the hints of omitted fields', () => {
    const h = Article.omit('body').getHints();
    expect(h?.sql).toBeUndefined();
    expect(h?.graphql?.title?.description).toBe('The headline');
  });

  it('rename() remaps hint keys with their fields', () => {
    const h = Article.rename({ body: 'content' }).getHints() as Record<string, Record<string, unknown>> | undefined;
    expect(h?.sql?.content).toEqual({ columnType: 'tsvector', index: 'gin' });
    expect(h?.sql?.body).toBeUndefined();
  });

  it('partial() and extend() pass hints through', () => {
    expect(Article.partial().getHints()?.sql?.body?.columnType).toBe('tsvector');
    expect(Article.extend({ extra: text() }).getHints()?.graphql?.title?.description).toBe('The headline');
  });

  it('a derivation dropping every hinted field carries no hints', () => {
    expect(Article.pick('id').getHints()).toBeUndefined();
  });

  it('type-level: only registered adapters / real fields / known options are accepted', () => {
    // @ts-expect-error — 'mongo' is not a registered adapter
    entity({ id: primary() }, { hints: { mongo: { id: {} } } });

    // @ts-expect-error — 'missing' is not a field of this entity
    entity({ id: primary() }, { hints: { sql: { missing: { columnType: 'x' } } } });

    // @ts-expect-error — 'wat' is not a known sql hint option
    entity({ id: primary() }, { hints: { sql: { id: { wat: 1 } } } });

    // Accepted: registered adapter, real field, known option
    entity({ id: primary() }, { hints: { sql: { id: { columnType: 'uuid' } } } });

    expect(true).toBe(true);
  });
});

describe('HintSet refuses what it addresses, and carries the rest', () => {
  it('an adapter whose hints are not addressed by field name is refused, by name', () => {
    expect(() =>
      // @ts-expect-error — the runtime refusal is the point; the type already says no
      entity({ id: primary(), body: text() }, { hints: { sql: 'tsvector' } }),
    ).toThrow(/hints\.sql: expected an object keyed by field name, got string/);
  });

  it('a field hint is the adapter\'s shape and is carried, never judged', () => {
    // `schema` knows no sql option, so a bare string reaches the adapter untouched.
    class Loose extends entity(
      { id: primary(), body: text() },
      // @ts-expect-error — the sql adapter of this test file declares an object
      { hints: { sql: { body: 'tsvector' } } },
    ) {}
    expect(Loose.getHints()?.sql?.body).toBe('tsvector');
  });

  it('an empty set is an absence, not an empty object', () => {
    class Empty extends entity({ id: primary() }, { hints: { sql: {} } }) {}
    expect(Empty.getHints()).toBeUndefined();
  });
});
