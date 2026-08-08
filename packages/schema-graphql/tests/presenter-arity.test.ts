import SchemaBuilder from '@pothos/core';
import { describe, expect, it } from 'vitest';
import { entity, primary, text } from '@fougere/schema';
import { registerType } from '../src/pothos.js';
import { registerAll } from '../src/auto-register.js';

/**
 * A computed field says how MANY values it carries.
 *
 * A presenter method is handed the page and answers one value per row, so the outer array
 * level of its return type is the page — what remains is the field's own arity. Nothing
 * measured that remainder, so `tags(posts: Post[]): string[][]` read exactly like
 * `excerpt(posts: Post[]): string[]` and both were announced as a lone `String`: a client
 * asking for `tags` got a schema saying one value where the row carried several.
 *
 * The scan measures it (`arrayDepth` in the parser, `list` on the field meta); this file is
 * the projection reading it.
 */
class Post extends entity({ id: primary(), body: text() }) {}

function fieldsOfPost(meta: { name: string; returnType?: string; list?: boolean }[]) {
  const builder = new SchemaBuilder({});
  builder.queryType({ fields: (t: any) => ({ ok: t.boolean({ resolve: () => true }) }) });
  registerType(builder, {
    name: 'Post',
    entity: Post,
    // The instance is only read for `typeof … === 'function'`; the values come off the row.
    presenter: Object.fromEntries(meta.map((m) => [m.name, () => []])) as never,
    presenterFields: meta.map((m) => m.name),
    presenterFieldMeta: meta,
  });
  return (builder.toSchema().getTypeMap().Post as any).getFields();
}

describe('the arity of a computed field', () => {
  it('announces a list where the field emits several values per row', () => {
    const fields = fieldsOfPost([
      { name: 'tags', returnType: 'string', list: true },
      { name: 'scores', returnType: 'number', list: true },
      { name: 'flags', returnType: 'boolean', list: true },
    ]);

    // The list is nullable, its items are not — the same shape an entity's own list field
    // gets (`fieldToGraphQL`, case 'array'), so a computed list reads like any other list.
    expect(String(fields.tags.type)).toBe('[String!]');
    expect(String(fields.scores.type)).toBe('[Float!]');
    expect(String(fields.flags.type)).toBe('[Boolean!]');
  });

  it('leaves a single value alone', () => {
    const fields = fieldsOfPost([
      { name: 'excerpt', returnType: 'string', list: false },
      { name: 'wordCount', returnType: 'number', list: false },
      { name: 'isLong', returnType: 'boolean', list: false },
    ]);

    expect(String(fields.excerpt.type)).toBe('String');
    expect(String(fields.wordCount.type)).toBe('Float');
    expect(String(fields.isLong.type)).toBe('Boolean');
  });

  /** A presenter scanned before this existed carries no `list` — it is a scalar, as before. */
  it('treats an unmeasured field as a single value', () => {
    const fields = fieldsOfPost([{ name: 'excerpt', returnType: 'string' }]);

    expect(String(fields.excerpt.type)).toBe('String');
  });

  /**
   * A declared view wins over the measured arity: `Presenter(Order, { items: [LineView] })`
   * is the author stating both the shape and the count, and it is read before this.
   */
  it('serves the value the row carries, list or not', async () => {
    const fields = fieldsOfPost([{ name: 'tags', returnType: 'string', list: true }]);

    expect(await fields.tags.resolve({ id: '1', tags: ['a', 'b'] }, {}, {}, {})).toEqual(['a', 'b']);
  });

  /**
   * The measurement is taken by the scan and read by `registerType`; between them sits
   * `registerAll`, which hands the scanned `fieldMeta` over. This package is deliberately
   * free of `@fougere/core`, so a real scan cannot be run here — what is covered is the
   * hand-off, on the shape the scanner produces.
   */
  it('carries the measured arity from the scanned frond to the type', () => {
    const app = {
      fronds: [{
        name: 'blog',
        entities: [{ name: 'post', entityClass: Post }],
        handlers: [{ address: 'post', operations: new Map() }],
        presenters: [{
          entityName: 'post',
          fields: ['tags', 'excerpt'],
          fieldMeta: [
            { name: 'tags', returnType: 'string', list: true },
            { name: 'excerpt', returnType: 'string', list: false },
          ],
        }],
      }],
      resolve: () => ({ tags: () => [], excerpt: () => [] }),
      facadeFor: () => ({ list: async () => [] }),
    };

    const builder = new SchemaBuilder({});
    builder.queryType({});
    builder.mutationType({});
    registerAll(builder, app as never);

    const fields = (builder.toSchema().getTypeMap().Post as any).getFields();
    expect(String(fields.tags.type)).toBe('[String!]');
    expect(String(fields.excerpt.type)).toBe('String');
  });
});
