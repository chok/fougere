import { describe, it, expect } from 'vitest';
import { entity, primary, text, number, oneOf, bool, type StandardSchemaV1 } from '../src/index.js';

// The new carrier: `class X extends entity({...})`. Proves the factory replaces
// the field-bag (no `new` to read metadata, real data instances, honest types).
class Post extends entity({
  id: primary(),
  title: text({ min: 1 }),
  views: number({ min: 0 }),
  status: oneOf('draft', 'published'),
  pinned: bool({ default: false }),
}) {}

describe('entity() factory carrier', () => {
  it('new Post(data) yields a REAL data instance (not a bag of Fields)', () => {
    const p = new Post({ id: 'x', title: 'Hi', views: 3, status: 'draft', pinned: false });
    expect(p.id).toBe('x');           // string, not a Field
    expect(p.title).toBe('Hi');
    expect(p instanceof Post).toBe(true);
  });

  it('getFields() reads metadata statically — no instantiation', () => {
    const f = Post.getFields();
    expect(Object.keys(f)).toEqual(['id', 'title', 'views', 'status', 'pinned']);
    expect(f.status.shape).toEqual({ type: 'string', enum: ['draft', 'published'] });
  });

  it('validate() runs on a plain object', () => {
    expect(Post.validate({ id: 'x', title: 'Hi', views: 1, status: 'draft' }).success).toBe(true);
    expect(Post.validate({ id: 'x', title: '', views: 1, status: 'draft' }).success).toBe(false);   // min:1
    expect(Post.validate({ id: 'x', title: 'Hi', views: 1, status: 'nope' }).success).toBe(false);  // enum
  });

  it('derivations return the same carrier (pick/omit/partial/extend)', () => {
    expect(Object.keys(Post.pick('id', 'title').getFields())).toEqual(['id', 'title']);
    expect(Object.keys(Post.omit('pinned').getFields())).toEqual(['id', 'title', 'views', 'status']);
    expect(Post.partial().getOpts().patch).toBe(true);
    expect(Object.keys(Post.extend({ slug: text() }).getFields())).toContain('slug');
  });

  it('a derived view is still extendable as a class (the Fougere view pattern)', () => {
    class CreatePost extends Post.pick('title', 'status') {}
    const c = new CreatePost({ title: 'Hello', status: 'published' });
    expect(c.title).toBe('Hello');
    expect(Object.keys(CreatePost.getFields())).toEqual(['title', 'status']);
  });

  it('can explicitly name a derivation used outside a class declaration', () => {
    const PublicPost = Post.pick('id', 'title').named('PublicPost');
    expect(PublicPost.name).toBe('PublicPost');
    expect(() => Post.pick('id').named('../Escape')).toThrow(/valid class name/);
  });

  it('refuses to rename what a class declaration already named', () => {
    // Every projection reads this name — the table, the GraphQL type, the registration
    // key. Renaming a declared class in place would move all three at once.
    expect(() => (Post as unknown as { named(n: string): unknown }).named('Other'))
      .toThrow(/already named by its class declaration/);
    expect(Post.name).toBe('Post');
  });

  it('exposes ~standard for ecosystem interop', () => {
    const std = Post['~standard'];
    expect(std.version).toBe(1);
    expect(std.vendor).toBe('fougere');
    const ok = std.validate({ id: 'x', title: 'Hi', views: 1, status: 'draft' });
    expect((ok as StandardSchemaV1.SuccessResult<unknown>).value).toMatchObject({ id: 'x' });
  });

  it('type-level: Post IS the data type, enum is a literal union', () => {
    // Compiles iff `Post` is the data shape and status is the literal union.
    const p: Post = { id: 'x', title: 'Hi', views: 1, status: 'published', pinned: true };
    const s: Post['status'] = 'draft';
    type Create = InstanceType<ReturnType<typeof Post.pick<'title'>>>;
    const _c: Create = { title: 'x' };
    expect(p.status).toBe('published');
    expect(s).toBe('draft');
    expect(_c.title).toBe('x');
  });
});
