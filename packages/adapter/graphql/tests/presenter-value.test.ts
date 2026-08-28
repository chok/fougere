import SchemaBuilder from '@pothos/core';
import { describe, expect, it, vi } from 'vitest';
import { entity, primary, text } from '@fougere/schema';
import { registerType } from '../src/pothos.js';

/**
 * A computed field is READ from the row, never recomputed here.
 *
 * The façade applies the presenter on every door (`PresenterExecutor` in @fougere/core), so a
 * row reaches GraphQL already carrying its computed fields. This projection used to call the
 * method a second time — duplicated work, and outright broken once a computed field started
 * receiving the PAGE rather than one row: the second call handed it a single object and it
 * threw `posts.map is not a function`.
 *
 * Every other presenter test asserts the SHAPE of the schema — which field names and types
 * exist. None resolved a value, which is exactly how the second call survived.
 */
class Post extends entity({ id: primary(), body: text() }) {}

/** Written the way presenters are written today: the page in, one value per row out. */
class PostPresenter {
  excerpt(posts: Post[]): string[] {
    return posts.map((p) => (p as { body: string }).body.slice(0, 7));
  }
}

function excerptField(presenter: object) {
  const builder = new SchemaBuilder({});
  builder.queryType({ fields: (t: any) => ({ ok: t.boolean({ resolve: () => true }) }) });
  registerType(builder, {
    name: 'Post',
    entity: Post,
    presenter: presenter as never,
    presenterFields: ['excerpt'],
    presenterFieldMeta: [{ name: 'excerpt', returnType: 'string' }],
  });
  return (builder.toSchema().getTypeMap().Post as any).getFields().excerpt;
}

describe('a computed field reaching GraphQL', () => {
  it('serves the value the façade already computed', async () => {
    const field = excerptField(new PostPresenter());
    const row = { id: '1', body: 'bonjour tout le monde', excerpt: 'bonjour' };

    expect(await field.resolve(row, {}, {}, {})).toBe('bonjour');
  });

  /**
   * The presenter is not called: it takes the page, and a resolver only ever holds one row.
   * Calling it here threw before this test existed.
   */
  it('does not call the presenter method', async () => {
    const presenter = new PostPresenter();
    const spy = vi.spyOn(presenter, 'excerpt');
    const field = excerptField(presenter);

    await field.resolve({ id: '1', body: 'bonjour tout le monde', excerpt: 'bonjour' }, {}, {}, {});
    expect(spy).not.toHaveBeenCalled();
  });

  /** An op that named a closed view emits no computed field — absent, not invented. */
  it('answers null when the row carries no such field', async () => {
    const field = excerptField(new PostPresenter());

    expect(await field.resolve({ id: '1', body: 'bonjour' }, {}, {}, {})).toBeNull();
  });
});
