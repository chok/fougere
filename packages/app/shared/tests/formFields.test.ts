import { describe, it, expect } from 'vitest';
import { Card, entity, primary, text, email, url, number, bool, date, created, oneOf, ref, many, optional, writeOnly } from '@fougere/schema';
import { formFieldsOf, tableColumnsOf, payloadOf, errorsByField } from '../src/form.js';

class Author extends entity({ id: primary(), name: text() }) {}

class Article extends entity({
  id: primary(),
  title: text({ min: 1, max: 200 }),
  views: number({ min: 0 }),
  published: bool(),
  status: oneOf('draft', 'live'),
  secret: writeOnly(text()),
  subtitle: optional(text()),
  contact: email(),
  source: url(),
  publishAt: date(),
  authorId: ref(Author),
  createdAt: created(),
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
    // A format the browser has a type for is a control of its own. Before this, an
    // email field came out as `text` and the page typed `type="email"` by hand —
    // spelling a second time what the card already said.
    expect(byName.contact.control).toBe('email');
    expect(byName.source.control).toBe('url');
    expect(byName.publishAt.control).toBe('date');
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

describe('errorsByField — local validator and wire validator share the shape', () => {
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
    createdAt: created(),
  }) {}

  const fields = formFieldsOf(Doc as never, 'doc');
  const by = (n: string) => fields.find((f) => f.name === n)!;

  it('carries the literal a field is born with', () => {
    expect(by('visibility').default).toBe('public');
  });

  it('carries nothing for a field whose value is decided at write time', () => {
    // `created()` is `lifecycle.create = 'now'` — a rule with no literal to show.
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

describe('formFieldsOf — what the browser enforces, under the names it knows', () => {
  const byName = Object.fromEntries(
    formFieldsOf(Article as never, 'article').map((f) => [f.name, f]),
  );

  it('carries a string field bounds as minlength/maxlength', () => {
    expect(byName.title.attrs).toEqual({ type: 'text', required: true, minlength: 1, maxlength: 200 });
  });

  it('carries a number field bound as min, and omits the one not stated', () => {
    expect(byName.views.attrs).toEqual({ type: 'number', required: true, min: 0 });
  });

  it('names the type a format has, so the page states no rule of its own', () => {
    // The whole point: `type="email"` used to be typed by hand in the page, next to a
    // card that already said `format: 'email'`. The browser checks it live, per field.
    expect(byName.contact.attrs).toEqual({ type: 'email', required: true });
    expect(byName.source.attrs).toEqual({ type: 'url', required: true });
  });

  it('emits no `required` when the lifecycle answers the absence', () => {
    // Absence emits nothing rather than `required="false"` — a browser reads presence.
    expect(byName.subtitle.attrs).toEqual({ type: 'text' });
  });

  it('gives a date no type: the browser would accept what the validator refuses', () => {
    // Neither `date` nor `datetime-local` produces the RFC 3339 string a `date-time`
    // shape validates. `control` still says `date` — the page picks the widget.
    expect(byName.publishAt.attrs).toEqual({ required: true });
  });

  it('gives a checkbox no `required`: there it would mean "must be checked"', () => {
    // The shape says the value must be SUPPLIED, and `false` is a value.
    expect(byName.published.attrs).toBeUndefined();
  });

  it('leaves an enum to `options` — a select is not an input', () => {
    expect(byName.status.attrs).toEqual({ required: true });
    expect(byName.status.options).toEqual(['draft', 'live']);
  });
});

describe('tableColumnsOf — the dual', () => {
  const columns = tableColumnsOf(Article as never, 'article');
  const byName = Object.fromEntries(columns.map((c) => [c.name, c]));

  it('membership is the OTHER io projection: the key and the stamp are columns', () => {
    // What a form excludes because a client may not supply it, a list shows.
    expect(byName.id).toBeDefined();
    expect(byName.createdAt).toBeDefined();
  });

  it('a write-only field is not a column (it is input, never output)', () => {
    expect(byName.secret).toBeUndefined();
  });

  it('renders derive from the shape, and a closed set prints as its value', () => {
    expect(byName.title.render).toBe('text');
    expect(byName.views.render).toBe('number');
    expect(byName.published.render).toBe('boolean');
    expect(byName.publishAt.render).toBe('date');
    expect(byName.status.render).toBe('text');
  });

  it('a reference is a link, and names the door it points at', () => {
    expect(byName.authorId.render).toBe('link');
    expect(byName.authorId.to).toBe('author');
  });

  it('a collection is no column: a cell holds one value', () => {
    class Tag extends entity({ id: primary(), label: text() }) {}
    class Post extends entity({ id: primary(), tags: many(Tag) }) {}
    expect(tableColumnsOf(Post as never, 'post').map((c) => c.name)).toEqual(['id']);
  });

  it('the label convention is the form’s, spelled once', () => {
    expect(byName.title.labelKey).toBe('article.title');
    expect(byName.title.label).toBe('Title');
  });

  it('works on an entity rebuilt from the card — the back-office case', () => {
    // A page reads `rpc.discover`, not the class: what a remote frond serves has no
    // constructor here. The reference survives the trip as its target's name.
    const rebuilt = Card.fromSchema(Article as never, 'article').toSchema();
    const cols = Object.fromEntries(
      tableColumnsOf(rebuilt as never, 'article').map((c) => [c.name, c]),
    );
    expect(Object.keys(cols)).toEqual(Object.keys(byName));
    expect(cols.authorId).toEqual({ ...byName.authorId });
    expect(cols.publishAt.render).toBe('date');
  });
});
