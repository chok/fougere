import { describe, expect, it } from 'vitest';
import { entity } from '../src/entity.js';
import { Schema } from '../src/Schema.js';
import { text } from '../src/vocabulary/text.js';

class Post extends entity({
  a: text(),
  b: text(),
  c: text(),
}) {}

describe('source identity across derivations', () => {
  it('points a chained pick and omit at the root entity', () => {
    const intermediate = Post.pick('a', 'b');
    const derived = intermediate.omit('b');

    expect(derived.derivation?.source).toBe(Post);
    expect(derived.derivation?.source).not.toBe(intermediate);
  });

  it('keeps the current root source through partial', () => {
    const derived = Post.pick('a', 'b');

    expect(derived.partial().derivation?.source).toBe(Post);
  });

  it('keeps the current root source through extend', () => {
    const derived = Post.pick('a', 'b');

    expect(derived.extend({ extra: text() }).derivation?.source).toBe(Post);
  });

  it('does not give a composed schema a source', () => {
    const composed = Schema.compose(Post.pick('a'), Post.omit('a', 'b'));

    expect(composed.derivation?.source).toBeUndefined();
  });

  it('does not give a non-derived entity a source', () => {
    expect(Post.derivation?.source).toBeUndefined();
  });
});
