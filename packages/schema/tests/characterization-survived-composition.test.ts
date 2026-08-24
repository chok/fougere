import { describe, expect, it } from 'vitest';
import { entity } from '../src/entity.js';
import { text } from '../src/vocabulary/text.js';

class Post extends entity({
  a: text(),
  b: text(),
  c: text(),
  d: text(),
}) {}

describe('survived composition', () => {
  it('records which origin fields survive a pick', () => {
    expect(Post.pick('a', 'b').derivation?.survived).toEqual({
      a: 'a',
      b: 'b',
      c: undefined,
      d: undefined,
    });
  });

  it('records which origin fields survive an omit', () => {
    expect(Post.omit('b').derivation?.survived).toEqual({
      a: 'a',
      b: undefined,
      c: 'c',
      d: 'd',
    });
  });

  it('records current names after a rename', () => {
    expect(Post.rename({ a: 'alpha', c: 'gamma' }).derivation?.survived).toEqual({
      a: 'alpha',
      b: 'b',
      c: 'gamma',
      d: 'd',
    });
  });

  it('composes pick, omit, and rename in that order', () => {
    const derived = Post.pick('a', 'b', 'c').omit('b').rename({ c: 'gamma' });

    expect(derived.derivation?.survived).toEqual({
      a: 'a',
      b: undefined,
      c: 'gamma',
      d: undefined,
    });
  });

  it('composes rename, omit, and pick in the reverse order', () => {
    const derived = Post.rename({ a: 'alpha', c: 'gamma' }).omit('b').pick('alpha', 'gamma');

    expect(derived.derivation?.survived).toEqual({
      a: 'alpha',
      b: undefined,
      c: 'gamma',
      d: undefined,
    });
  });

  it('marks a renamed field absent when its current name is removed', () => {
    const derived = Post.rename({ b: 'beta' }).omit('beta');

    expect(derived.derivation?.survived).toEqual({
      a: 'a',
      b: undefined,
      c: 'c',
      d: 'd',
    });
  });

  it('does not add an origin entry for a field introduced by extend', () => {
    const derived = Post.pick('a').extend({ extra: text() });

    expect(Object.keys(derived.getFields())).toEqual(['a', 'extra']);
    expect(derived.derivation?.survived).toEqual({
      a: 'a',
      b: undefined,
      c: undefined,
      d: undefined,
    });
    expect(derived.derivation?.survived).not.toHaveProperty('extra');
  });
});
