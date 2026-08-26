import { describe, it, expect } from 'vitest';
import { entity } from '../src/entity.js';
import { primary } from '../src/vocabulary/primary.js';
import { text } from '../src/vocabulary/text.js';
import { number } from '../src/vocabulary/number.js';
import { bool } from '../src/vocabulary/bool.js';
import type { StandardSchemaV1 } from '../src/projection/standard.js';

class Post extends entity({
  id: primary(),
  title: text({ min: 1, max: 200 }),
  views: number({ min: 0 }),
  draft: bool({ default: false }),
}) {}

type MaybeAsync<T> = StandardSchemaV1.Result<T> | Promise<StandardSchemaV1.Result<T>>;

// Narrow-or-fail, no casts: each step asserts a contract (fougere validates
// synchronously; `issues` is the union's discriminant) instead of muting the
// compiler right where the test claims to check it.
function ok<T>(result: MaybeAsync<T>): T {
  if (result instanceof Promise) throw new Error('expected a sync result');
  if (result.issues) throw new Error(`expected success, got: ${result.issues[0]?.message}`);
  return result.value;
}

function issuesOf<T>(result: MaybeAsync<T>): readonly StandardSchemaV1.Issue[] {
  if (result instanceof Promise) throw new Error('expected a sync result');
  if (!result.issues) throw new Error('expected failure, got success');
  return result.issues;
}

describe('Standard Schema v1', () => {
  describe('Entity', () => {
    it('exposes ~standard property', () => {
      const std = Post['~standard'];
      expect(std.version).toBe(1);
      expect(std.vendor).toBe('fougere');
      expect(typeof std.validate).toBe('function');
    });

    it('validates successfully — absent defaulted field is judged legal, not filled', () => {
      const value = ok(Post['~standard'].validate({ id: 'abc', title: 'Hello', views: 10 }));
      expect(value).toMatchObject({ id: 'abc', title: 'Hello', views: 10 });
      expect('draft' in value).toBe(false); // storage realises the default
    });

    it('returns issues on failure', () => {
      const issues = issuesOf(Post['~standard'].validate({ id: 'abc', title: '', views: -1 }));
      expect(issues.length).toBeGreaterThan(0);
      expect(issues[0]).toHaveProperty('message');
    });

    it('returns path segments on field errors', () => {
      const issues = issuesOf(Post['~standard'].validate({ id: 'abc', title: '', views: 0 }));
      const titleIssue = issues.find((i) =>
        i.path?.some((p) => (typeof p === 'object' && 'key' in p ? p.key : p) === 'title'),
      );
      expect(titleIssue).toBeDefined();
    });

    it('returns no path for top-level errors', () => {
      const issues = issuesOf(Post['~standard'].validate(null));
      expect(issues.length).toBe(1);
      expect(issues[0].path).toBeUndefined();
    });

    it('satisfies StandardSchemaV1 interface', () => {
      // Type-level check: Post should be assignable to StandardSchemaV1
      const _check: StandardSchemaV1 = Post;
      expect(_check).toBe(Post);
    });
  });

  describe('SchemaConstructor (derivation)', () => {
    const CreatePost = Post.omit('id');

    it('exposes ~standard property', () => {
      const std = CreatePost['~standard'];
      expect(std.version).toBe(1);
      expect(std.vendor).toBe('fougere');
      expect(typeof std.validate).toBe('function');
    });

    it('validates successfully — absent defaulted field is judged legal, not filled', () => {
      const value = ok(CreatePost['~standard'].validate({ title: 'Hello', views: 5 }));
      expect(value).toMatchObject({ title: 'Hello', views: 5 });
      expect('draft' in value).toBe(false); // storage realises the default
    });

    it('returns issues on failure', () => {
      const issues = issuesOf(CreatePost['~standard'].validate({}));
      expect(issues.length).toBeGreaterThan(0);
    });

    it('satisfies StandardSchemaV1 interface', () => {
      const _check: StandardSchemaV1 = CreatePost;
      expect(_check).toBe(CreatePost);
    });
  });
});

/**
 * A path is not a sentence to be re-parsed.
 *
 * `validateFields` builds `path` as `pathPrefix ? `${prefix}.${key}` : key`, and
 * every caller passes `''` — the recursion `pathPrefix` exists for is not written,
 * so a path is always ONE field name. Splitting it on `.` therefore invents
 * segments the judge never made: a field legally named `a.b` came out as two.
 */
describe('a field name that contains a dot', () => {
  class Odd extends entity({ id: primary(), 'a.b': text({ min: 3 }) }) {}

  it('is one path segment, not two', () => {
    const issues = issuesOf(Odd['~standard'].validate({ id: '1', 'a.b': 'x' }));
    expect(issues[0].path).toEqual([{ key: 'a.b' }]);
  });
});
