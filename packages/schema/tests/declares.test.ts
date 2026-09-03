/**
 * `declares` is the ONE door for everything a schema states about itself, open wherever a
 * schema is. `entity(fields, …)` is the same statement written where the fields are.
 *
 * Before it, a derivation could state NONE of them: `Post.extend({ body })` answered
 * `undefined` to `getAdapters()` and to `getUnique()`, so a field the extend added could
 * never receive a per-adapter entry nor join a composite group.
 */
import { describe, it, expect } from 'vitest';
import { entity } from '../src/entity.js';
import { primary } from '../src/vocabulary/primary.js';
import { text } from '../src/vocabulary/text.js';

declare module '../src/entity/EntityAdapters.js' {
  interface FougereEntityAdapters<K extends string> {
    warehouse?: Partial<Record<K, { columnType?: string }>>;
  }
}

class Post extends entity(
  { id: primary(), tenantId: text(), title: text() },
  { adapters: { warehouse: { title: { columnType: 'text' } } } },
) {}

describe('what a derivation may now state about itself', () => {
  it('names an adapter entry for a field the extend added', () => {
    const stated = Post.extend({ slug: text() })
      .declares({ adapters: { warehouse: { slug: { columnType: 'citext' } } } })
      .getAdapters();

    expect(stated?.warehouse?.slug).toEqual({ columnType: 'citext' });
  });

  it('declares a composite group over a field the extend added', () => {
    const grouped = Post.extend({ slug: text() }).declares({ unique: [['tenantId', 'slug']] });

    expect(grouped.getUnique()).toEqual([['tenantId', 'slug']]);
  });

  it('keeps the fields it was handed, so the type does not move', () => {
    const stated = Post.anchor();

    expect(Object.keys(stated.getFields())).toEqual(['id', 'tenantId', 'title']);
  });
});

describe('how a declaration folds into what the schema already states', () => {
  it('merges per adapter, per field — the later spelling wins', () => {
    const stated = Post.declares({
      adapters: { warehouse: { title: { columnType: 'tsvector' }, tenantId: { columnType: 'uuid' } } },
    }).getAdapters();

    expect(stated?.warehouse).toEqual({ title: { columnType: 'tsvector' }, tenantId: { columnType: 'uuid' } });
  });

  it('carries what it does not mention', () => {
    expect(Post.anchor().getAdapters()?.warehouse?.title).toEqual({ columnType: 'text' });
  });

  it('sets `previous`, which no derivation gesture propagates', () => {
    expect(Post.declares({ previous: { title: 'headline' } }).previous).toEqual({ title: 'headline' });
    expect(Post.declares({ previous: { title: 'headline' } }).pick('title').previous).toBeUndefined();
  });

  it('leaves the origin alone — re-rooting is what anchoring does, and it does it downstream', () => {
    const stated = Post.pick('id', 'title').anchor();

    expect(stated.derivation?.source).toBe(Post);
    expect(stated.derivation?.here).toEqual({ id: 'id', tenantId: undefined, title: 'title' });
  });
});

describe('what the door refuses', () => {
  it('an adapter entry addressing a field the schema does not carry', () => {
    expect(() =>
      // @ts-expect-error — 'nope' is not a field of this schema
      Post.declares({ adapters: { warehouse: { nope: { columnType: 'x' } } } }),
    ).toThrow(/declares\(\): unknown field `nope`/);
  });

  it('a `previous` entry addressing a field the schema does not carry', () => {
    expect(() =>
      // @ts-expect-error — 'nope' is not a field of this schema
      Post.declares({ previous: { nope: 'old' } }),
    ).toThrow(/declares\(\): unknown field `nope`/);
  });

  it('an adapter statement not addressed by field at all', () => {
    expect(() =>
      // @ts-expect-error — the registry says an object keyed by field
      Post.declares({ adapters: { warehouse: 'tsvector' } }),
    ).toThrow(/adapters\.warehouse: expected an object keyed by field name/);
  });

  it('a unique group naming a field the schema does not carry', () => {
    // @ts-expect-error — 'nope' is not a field of this schema
    expect(() => Post.declares({ unique: [['tenantId', 'nope']] })).toThrow(/which the entity does not declare/);
  });
});

describe('`entity(fields, …)` is the short form of the same statement', () => {
  const declared = { adapters: { warehouse: { title: { columnType: 'tsvector' } } } } as const;

  it('lands the same adapters either way', () => {
    class AtDeclaration extends entity({ id: primary(), title: text() }, declared) {}
    const afterwards = entity({ id: primary(), title: text() }).declares(declared);

    expect(afterwards.getAdapters()).toEqual(AtDeclaration.getAdapters());
  });

  it('refuses the same unknown field either way', () => {
    // @ts-expect-error — 'nope' is not a field of this entity
    expect(() => entity({ id: primary() }, { previous: { nope: 'old' } })).toThrow(/unknown field `nope`/);
    // @ts-expect-error — 'nope' is not a field of this entity
    expect(() => entity({ id: primary() }).declares({ previous: { nope: 'old' } })).toThrow(/unknown field `nope`/);
  });
});
