import { describe as group, expect, it } from 'vitest';
import { describe, describeSet } from '../src/card/describe.js';
import { diff, diffSet } from '../src/card/diff.js';
import { reconstruct, reconstructSet } from '../src/card/reconstruct.js';
import { entity } from '../src/entity.js';
import { optional } from '../src/vocabulary/optional.js';
import { primary } from '../src/vocabulary/primary.js';
import { text } from '../src/vocabulary/text.js';

class Post extends entity({
  id: primary(),
  title: text(),
  body: text(),
}) {}

class NextPost extends entity({
  id: primary(),
  title: text(),
  body: optional(text()),
}) {}

group('single-card and bundle parity', () => {
  it('describes a schema identically by itself and in a set', () => {
    expect(describeSet({ post: Post }).$defs.post).toEqual(describe(Post, 'post'));
  });

  it('reconstructs a schema identically by itself and from a set', () => {
    const card = JSON.parse(JSON.stringify(describe(Post, 'post')));
    const bundle = JSON.parse(JSON.stringify(describeSet({ post: Post })));
    const single = reconstruct(card);
    const fromSet = reconstructSet(bundle).post;

    expect(describe(fromSet, 'post')).toEqual(describe(single, 'post'));
  });

  it('diffs a schema identically by itself and in a set', () => {
    const before = describe(Post, 'post');
    const after = describe(NextPost, 'post');
    const setDiff = diffSet(describeSet({ post: Post }), describeSet({ post: NextPost }));

    expect(setDiff.entities.post).toEqual(diff(before, after));
  });
});
