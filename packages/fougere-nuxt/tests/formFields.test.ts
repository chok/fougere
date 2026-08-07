import { describe, it, expect } from 'vitest';
import { entity, primary, text, number, bool, auto, oneOf, ref, optional, writeOnly } from '@fougere/schema';
import { formFieldsOf, payloadOf, errorsByField } from '../src/runtime/form/fields.js';

class Author extends entity({ id: primary(), name: text() }) {}

class Article extends entity({
  id: primary(),
  title: text({ min: 1, max: 200 }),
  views: number({ min: 0 }),
  published: bool(),
  status: oneOf('draft', 'live'),
  secret: writeOnly(text()),
  subtitle: optional(text()),
  authorId: ref(Author),
  createdAt: auto(),
}) {}

describe('formFieldsOf — membership and axes', () => {
  const fields = formFieldsOf(Article as never, 'article');
  const byName = Object.fromEntries(fields.map((f) => [f.name, f]));

  it('membership follows the io projection: no primary, no managed timestamp', () => {
    expect(Object.keys(byName)).not.toContain('id');
    expect(Object.keys(byName)).not.toContain('createdAt');
  });

  it('a write-only field enters the form (it is input, never output)', () => {
    expect(byName.secret).toBeDefined();
  });

  it('requiredness comes from the lifecycle axis', () => {
    expect(byName.title.required).toBe(true);
    expect(byName.subtitle.required).toBe(false);
  });

  it('controls derive from the shape', () => {
    expect(byName.title.control).toBe('text');
    expect(byName.views.control).toBe('number');
    expect(byName.published.control).toBe('boolean');
    expect(byName.status.control).toBe('select');
    expect(byName.status.options).toEqual(['draft', 'live']);
  });

  it('labels are convention keys — the schema carries no display text', () => {
    expect(byName.title.labelKey).toBe('article.title');
    expect(byName.title.label).toBe('Title');
  });
});

describe('payloadOf — an empty control is an absent value', () => {
  it('drops empty strings and undefined, keeps everything else', () => {
    expect(payloadOf({ title: 'a', subtitle: '', views: 0, published: false, secret: undefined }))
      .toEqual({ title: 'a', views: 0, published: false });
  });
});

describe('errorsByField — local judge and wire judge share the shape', () => {
  it('indexes by first path segment, keeps the first message per field', () => {
    const local = (Article as never as { validate(i: unknown): { success: false; errors: { path: string; message: string }[] } })
      .validate({ views: 1, published: true, status: 'draft', secret: 'x', authorId: 'a1' });
    expect(local.success).toBe(false);
    const byField = errorsByField(local.errors);
    expect(byField.title).toBeTruthy();
    expect(Object.keys(byField)).not.toContain('subtitle');
  });
});

describe('declared defaults', () => {
  class Doc extends entity({
    id: primary(),
    title: text(),
    visibility: oneOf('public', 'private', { default: 'public' }),
    createdAt: auto(),
  }) {}

  const fields = formFieldsOf(Doc as never, 'doc');
  const by = (n: string) => fields.find((f) => f.name === n)!;

  it('carries the literal a field is born with', () => {
    expect(by('visibility').default).toBe('public');
  });

  it('carries nothing for a field whose value is decided at write time', () => {
    // `auto()` is `lifecycle.create = 'now'` — a rule with no literal to show.
    // (It is server-owned anyway, so it never reaches a form.)
    expect(by('title').default).toBeUndefined();
    expect(fields.map((f) => f.name)).not.toContain('createdAt');
  });

  it('a declared default does not make the field required', () => {
    // The create rule answers the absence — that is what `required: false` means.
    expect(by('visibility').required).toBe(false);
    expect(by('title').required).toBe(true);
  });
});

describe('formFieldsOf — the bounds, under the names a browser enforces', () => {
  const byName = Object.fromEntries(
    formFieldsOf(Article as never, 'article').map((f) => [f.name, f]),
  );

  it('carries a string field bounds as minlength/maxlength', () => {
    expect(byName.title.attrs).toEqual({ minlength: 1, maxlength: 200 });
  });

  it('carries a number field bound as min, and omits the one not stated', () => {
    expect(byName.views.attrs).toEqual({ min: 0 });
  });

  it('states nothing when the shape states nothing', () => {
    expect(byName.published.attrs).toBeUndefined();
    expect(byName.subtitle.attrs).toBeUndefined();
  });

  it('leaves an enum to `options` — a select has no bound to enforce', () => {
    expect(byName.status.attrs).toBeUndefined();
    expect(byName.status.options).toEqual(['draft', 'live']);
  });
});
